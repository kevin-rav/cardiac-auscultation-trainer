import { createBeatGenerator, type Beat, type BeatGenerator } from '../engine/beats';
import { resolveSoundSet } from '../engine/resolve';
import type { Location, Manifest, Rhythm, SoundSet } from '../engine/schema';
import { scheduleEvents, type ScheduledEvent } from '../engine/scheduler';
import { getAudioContext, resumeAudioContext } from './context';
import { AudioGraph } from './graph';
import { SampleLoader } from './loader';

interface ActiveVoice {
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
  readonly highpass?: BiquadFilterNode | undefined;
  readonly lowpass?: BiquadFilterNode | undefined;
}

export class CardiacAudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioGraph: AudioGraph | null = null;
  private sampleLoader: SampleLoader | null = null;

  private isPlaying = false;
  private soundSet: SoundSet;
  private location: Location | undefined;
  private manifest: Manifest | undefined;
  private rhythm: Rhythm = { type: 'regular', id: 'sinus', label: 'Normal Sinus Rhythm' };
  private bpm = 72;
  private volume = 1;

  private beatGenerator: BeatGenerator | null = null;
  private beatBuffer: Beat[] = [];
  private activeVoices = new Set<ActiveVoice>();
  private lookaheadIntervalId: ReturnType<typeof setInterval> | null = null;
  private nextScheduleTimeSec = 0;

  public constructor(
    initialSoundSet: SoundSet,
    initialLocation?: Location,
    initialManifest?: Manifest,
    ctx?: AudioContext,
  ) {
    this.soundSet = initialSoundSet;
    this.location = initialLocation;
    this.manifest = initialManifest;
    if (ctx) {
      this.initAudioNodes(ctx);
    }
  }

  private initAudioNodes(ctx: AudioContext): void {
    this.audioContext = ctx;
    this.audioGraph = new AudioGraph(ctx);
    this.sampleLoader = new SampleLoader(ctx);
    this.audioGraph.setVolume(this.volume);
  }

  public getOrCreateContext(): AudioContext {
    if (!this.audioContext) {
      const ctx = getAudioContext();
      this.initAudioNodes(ctx);
      return ctx;
    }
    return this.audioContext;
  }

  public getSampleLoader(): SampleLoader {
    this.getOrCreateContext();
    if (!this.sampleLoader) {
      throw new Error('SampleLoader not initialized');
    }
    return this.sampleLoader;
  }

  public getAudioGraph(): AudioGraph {
    this.getOrCreateContext();
    if (!this.audioGraph) {
      throw new Error('AudioGraph not initialized');
    }
    return this.audioGraph;
  }

  public setSoundSet(soundSet: SoundSet): void {
    this.soundSet = soundSet;
  }

  public setLocation(location?: Location): void {
    this.location = location;
  }

  public setManifest(manifest: Manifest): void {
    this.manifest = manifest;
  }

  public setBpm(bpm: number): void {
    this.bpm = Math.max(30, Math.min(220, bpm));
    if (this.isPlaying) {
      // Re-initialize beat generator starting from the next scheduled beat time
      this.beatGenerator = createBeatGenerator(this.rhythm, this.bpm, this.nextScheduleTimeSec);
      this.beatBuffer = [];
    }
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setRhythm(rhythm: Rhythm): void {
    this.rhythm = rhythm;
    if (this.isPlaying) {
      this.beatGenerator = createBeatGenerator(this.rhythm, this.bpm, this.nextScheduleTimeSec);
      this.beatBuffer = [];
    }
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(2, volume));
    if (this.audioGraph) {
      this.audioGraph.setVolume(this.volume);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public async play(): Promise<void> {
    const ctx = this.getOrCreateContext();
    await resumeAudioContext(ctx);

    if (this.isPlaying) return;

    this.isPlaying = true;
    this.nextScheduleTimeSec = ctx.currentTime;
    this.beatGenerator = createBeatGenerator(this.rhythm, this.bpm, this.nextScheduleTimeSec);
    this.beatBuffer = [];

    // Schedule initial upcoming window immediately
    this.tickScheduler();

    // Start dual-clock timer (25 ms interval looking 100 ms ahead)
    this.lookaheadIntervalId = setInterval(() => {
      this.tickScheduler();
    }, 25);
  }

  public stop(): void {
    if (this.lookaheadIntervalId) {
      clearInterval(this.lookaheadIntervalId);
      this.lookaheadIntervalId = null;
    }

    this.stopAllVoices();
    this.isPlaying = false;
    this.beatGenerator = null;
    this.beatBuffer = [];
  }

  private stopAllVoices(): void {
    if (!this.audioContext || this.activeVoices.size === 0) return;
    const now = this.audioContext.currentTime;

    for (const voice of this.activeVoices) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        // Clean anti-click fade out over 10 ms
        voice.gain.gain.linearRampToValueAtTime(0.0001, now + 0.01);
        voice.source.stop(now + 0.015);
      } catch {
        // Voice might already be stopped
      }
    }
    this.activeVoices.clear();
  }

  private tickScheduler(): void {
    if (!this.audioContext || !this.audioGraph || !this.beatGenerator) return;

    const ctx = this.audioContext;
    const lookaheadSec = 0.1; // 100 ms lookahead window
    const windowEndSec = ctx.currentTime + lookaheadSec;

    // Pull beats from generator until we reach windowEndSec
    let lastBeat = this.beatBuffer[this.beatBuffer.length - 1];
    while (!lastBeat || lastBeat.start < windowEndSec) {
      const nextBeat = this.beatGenerator.next().value;
      if (!nextBeat) break;
      this.beatBuffer.push(nextBeat);
      lastBeat = nextBeat;
    }

    // Resolve sound events for current soundSet and location
    const resolvedEvents = resolveSoundSet(this.soundSet, this.location, this.manifest);

    // Schedule events in [nextScheduleTimeSec, windowEndSec)
    const scheduled = scheduleEvents(
      this.beatBuffer,
      resolvedEvents,
      this.nextScheduleTimeSec,
      windowEndSec,
    );

    for (const event of scheduled) {
      this.triggerVoice(event);
    }

    this.nextScheduleTimeSec = windowEndSec;

    // Prune beats that have already elapsed past current time
    this.beatBuffer = this.beatBuffer.filter(
      (beat) => beat.start + beat.rr / 1000 >= ctx.currentTime,
    );
  }

  private triggerVoice(event: ScheduledEvent): void {
    if (!this.audioContext || !this.audioGraph || !this.sampleLoader) return;
    const ctx = this.audioContext;

    const buffer = this.sampleLoader.getBuffer(event.sampleId);
    if (!buffer) {
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = event.playbackRate;

    const voiceGain = ctx.createGain();
    let currentOutNode: AudioNode = source;

    let highpass: BiquadFilterNode | undefined;
    let lowpass: BiquadFilterNode | undefined;

    if (event.filter?.highpassHz !== undefined && event.filter.highpassHz > 20) {
      highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = event.filter.highpassHz;
      currentOutNode.connect(highpass);
      currentOutNode = highpass;
    }

    if (event.filter?.lowpassHz !== undefined && event.filter.lowpassHz < 20000) {
      lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = event.filter.lowpassHz;
      currentOutNode.connect(lowpass);
      currentOutNode = lowpass;
    }

    currentOutNode.connect(voiceGain);
    voiceGain.connect(this.audioGraph.masterGainNode);

    if (event.envelope) {
      // Sustained murmur voice shaped by curve
      source.loop = true;
      voiceGain.gain.setValueAtTime(0, event.time);
      const durationSec = event.envelope.durationMs / 1000;
      voiceGain.gain.setValueCurveAtTime(event.envelope.curve, event.time, durationSec);
      // Scale curve by event overall gain
      voiceGain.gain.setValueAtTime(event.gain, event.time);

      source.start(event.time);
      source.stop(event.time + durationSec + 0.02);
    } else {
      // One-shot transient sound event
      source.loop = false;
      voiceGain.gain.setValueAtTime(event.gain, event.time);
      source.start(event.time);
    }

    const voice: ActiveVoice = { source, gain: voiceGain, highpass, lowpass };
    this.activeVoices.add(voice);

    source.onended = () => {
      this.activeVoices.delete(voice);
      try {
        source.disconnect();
        voiceGain.disconnect();
        highpass?.disconnect();
        lowpass?.disconnect();
      } catch {
        // Already disconnected
      }
    };
  }

  public dispose(): void {
    this.stop();
    if (this.audioGraph) {
      this.audioGraph.dispose();
      this.audioGraph = null;
    }
    this.sampleLoader = null;
    this.audioContext = null;
  }
}
