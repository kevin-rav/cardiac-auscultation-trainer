/**
 * Infrasonic frequency (well below the human 20 Hz threshold) used to effectively
 * bypass the highpass biquad filter without graph rewiring.
 */
const HIGHPASS_BYPASS_FREQ_HZ = 10;

/**
 * Ultrasonic frequency (above the human 20 kHz threshold and standard Nyquist rate)
 * used to effectively bypass the lowpass biquad filter without graph rewiring.
 */
const LOWPASS_BYPASS_FREQ_HZ = 22000;

export interface PreviewOptions {
  highpassHz?: number | undefined;
  lowpassHz?: number | undefined;
  gain?: number | undefined;
  playbackRate?: number | undefined;
  loop?: boolean | undefined;
  bpm?: number | undefined;
}

export class AudioPreviewPlayer {
  private audioContext: AudioContext | null = null;
  private highpassFilterNode: BiquadFilterNode | null = null;
  private lowpassFilterNode: BiquadFilterNode | null = null;
  private masterGainNode: GainNode | null = null;
  private activeSourceNodes = new Set<AudioBufferSourceNode>();
  private schedulerIntervalId: ReturnType<typeof setInterval> | null = null;
  private nextBeatAudioTimeSec = 0;

  private loadedAudioBuffer: AudioBuffer | null = null;
  private isCurrentlyPlaying = false;
  private isLoopingEnabled = false;
  private beatsPerMinute = 72;
  private outputGain = 1;
  private playbackSpeedRate = 1;
  private highpassCutoffHz: number | undefined;
  private lowpassCutoffHz: number | undefined;
  private sampleCache = new Map<string, AudioBuffer>();
  private activeLoadingUrl: string | null = null;

  /**
   * Lazily initializes and resumes the Web Audio AudioContext on user interaction.
   */
  private getOrCreateAudioContext(): AudioContext {
    this.audioContext ??= new AudioContext();
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Connects the signal chain:
   * Source Node -> Highpass Filter -> Lowpass Filter -> Master Gain -> Audio Destination
   */
  private getOrCreateAudioGraph(): {
    highpass: BiquadFilterNode;
    lowpass: BiquadFilterNode;
    gain: GainNode;
  } {
    const ctx = this.getOrCreateAudioContext();
    if (!this.highpassFilterNode || !this.lowpassFilterNode || !this.masterGainNode) {
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value =
        this.highpassCutoffHz !== undefined && this.highpassCutoffHz > 0
          ? this.highpassCutoffHz
          : HIGHPASS_BYPASS_FREQ_HZ;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value =
        this.lowpassCutoffHz !== undefined && this.lowpassCutoffHz > 0
          ? this.lowpassCutoffHz
          : LOWPASS_BYPASS_FREQ_HZ;

      const gain = ctx.createGain();
      gain.gain.value = this.outputGain;

      highpass.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(ctx.destination);

      this.highpassFilterNode = highpass;
      this.lowpassFilterNode = lowpass;
      this.masterGainNode = gain;
    }
    return {
      highpass: this.highpassFilterNode,
      lowpass: this.lowpassFilterNode,
      gain: this.masterGainNode,
    };
  }

  public async loadAudioData(audioFileArrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.getOrCreateAudioContext();
    const decodedBuffer = await ctx.decodeAudioData(audioFileArrayBuffer);
    this.loadedAudioBuffer = decodedBuffer;
    return decodedBuffer;
  }

  public async loadSampleUrl(sampleAudioUrl: string): Promise<AudioBuffer | null> {
    const cachedBuffer = this.sampleCache.get(sampleAudioUrl);
    if (cachedBuffer) {
      this.loadedAudioBuffer = cachedBuffer;
      return cachedBuffer;
    }

    this.activeLoadingUrl = sampleAudioUrl;
    try {
      const response = await fetch(sampleAudioUrl);
      if (!response.ok) {
        console.error(`Failed to load audio sample from ${sampleAudioUrl}: ${response.statusText}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await this.loadAudioData(arrayBuffer);
      this.sampleCache.set(sampleAudioUrl, decodedBuffer);

      if (this.activeLoadingUrl === sampleAudioUrl) {
        this.loadedAudioBuffer = decodedBuffer;
      }
      return decodedBuffer;
    } catch (err) {
      console.error(`Error loading sample ${sampleAudioUrl}:`, err);
      return null;
    }
  }

  public setBuffer(buffer: AudioBuffer | null): void {
    this.loadedAudioBuffer = buffer;
  }

  public getBuffer(): AudioBuffer | null {
    return this.loadedAudioBuffer;
  }

  public setHighpass(frequencyHz?: number): void {
    this.highpassCutoffHz = frequencyHz;
    if (this.highpassFilterNode && this.audioContext) {
      if (frequencyHz !== undefined && frequencyHz > 0) {
        this.highpassFilterNode.frequency.setValueAtTime(
          frequencyHz,
          this.audioContext.currentTime,
        );
      } else {
        // Bypass highpass by setting to minimum sub-audible frequency
        this.highpassFilterNode.frequency.setValueAtTime(
          HIGHPASS_BYPASS_FREQ_HZ,
          this.audioContext.currentTime,
        );
      }
    }
  }

  public setLowpass(frequencyHz?: number): void {
    this.lowpassCutoffHz = frequencyHz;
    if (this.lowpassFilterNode && this.audioContext) {
      if (frequencyHz !== undefined && frequencyHz > 0) {
        this.lowpassFilterNode.frequency.setValueAtTime(frequencyHz, this.audioContext.currentTime);
      } else {
        // Bypass lowpass by setting above Nyquist / audible range
        this.lowpassFilterNode.frequency.setValueAtTime(
          LOWPASS_BYPASS_FREQ_HZ,
          this.audioContext.currentTime,
        );
      }
    }
  }

  public setGain(gainMultiplier: number): void {
    this.outputGain = gainMultiplier;
    if (this.masterGainNode && this.audioContext) {
      const nowSec = this.audioContext.currentTime;
      this.masterGainNode.gain.cancelScheduledValues(nowSec);
      this.masterGainNode.gain.setValueAtTime(Math.max(0, gainMultiplier), nowSec);
    }
  }

  public setPlaybackRate(speedRate: number): void {
    this.playbackSpeedRate = speedRate;
    const ctx = this.audioContext;
    const nowSec = ctx ? ctx.currentTime : 0;
    for (const sourceNode of this.activeSourceNodes) {
      try {
        sourceNode.playbackRate.setValueAtTime(Math.max(0.1, speedRate), nowSec);
      } catch {
        // Source may already have ended or been disposed
      }
    }
  }

  public setBpm(targetBpm: number): void {
    this.beatsPerMinute = Math.max(30, Math.min(220, targetBpm));
  }

  public getBpm(): number {
    return this.beatsPerMinute;
  }

  public setLoop(shouldLoop: boolean): void {
    this.isLoopingEnabled = shouldLoop;
    if (this.isCurrentlyPlaying) {
      if (shouldLoop && !this.schedulerIntervalId) {
        const ctx = this.getOrCreateAudioContext();
        this.nextBeatAudioTimeSec = Math.max(ctx.currentTime, this.nextBeatAudioTimeSec);
        this.scheduleUpcomingBeats();
        this.schedulerIntervalId = setInterval(() => {
          this.scheduleUpcomingBeats();
        }, 25);
      } else if (!shouldLoop && this.schedulerIntervalId) {
        clearInterval(this.schedulerIntervalId);
        this.schedulerIntervalId = null;
      }
    }
  }

  public getLoop(): boolean {
    return this.isLoopingEnabled;
  }

  /**
   * Instantiates and connects an AudioBufferSourceNode to trigger a single audio voice
   * at an exact timestamp on the AudioContext timeline.
   *
   * Web Audio source nodes are single-use: each beat occurrence requires a new node.
   */
  private scheduleSingleVoice(startTimeSec: number): AudioBufferSourceNode | null {
    if (!this.loadedAudioBuffer) return null;
    const ctx = this.getOrCreateAudioContext();
    const { highpass } = this.getOrCreateAudioGraph();

    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = this.loadedAudioBuffer;
    sourceNode.loop = false;
    sourceNode.playbackRate.value = this.playbackSpeedRate;
    sourceNode.connect(highpass);

    this.activeSourceNodes.add(sourceNode);
    sourceNode.onended = () => {
      this.activeSourceNodes.delete(sourceNode);
      if (!this.isLoopingEnabled && this.activeSourceNodes.size === 0) {
        this.isCurrentlyPlaying = false;
      }
    };

    sourceNode.start(startTimeSec);
    return sourceNode;
  }

  /**
   * Lookahead clock loop: inspects the upcoming 100 ms time window and pre-schedules
   * any beat voices that fall due, preventing timing jitter caused by main-thread pauses.
   */
  private scheduleUpcomingBeats(): void {
    const ctx = this.getOrCreateAudioContext();
    const lookaheadSec = 0.1;
    const beatIntervalSec = 60 / this.beatsPerMinute;

    while (this.nextBeatAudioTimeSec < ctx.currentTime + lookaheadSec) {
      this.scheduleSingleVoice(this.nextBeatAudioTimeSec);
      this.nextBeatAudioTimeSec += beatIntervalSec;
    }
  }

  public play(previewOptions?: PreviewOptions): void {
    const ctx = this.getOrCreateAudioContext();
    this.stop();

    this.loadedAudioBuffer ??= ctx.createBuffer(
      1,
      Math.floor(ctx.sampleRate * 0.1),
      ctx.sampleRate,
    );

    if (previewOptions) {
      if (previewOptions.gain !== undefined) this.outputGain = previewOptions.gain;
      if (previewOptions.playbackRate !== undefined) {
        this.playbackSpeedRate = previewOptions.playbackRate;
      }
      if (previewOptions.loop !== undefined) this.isLoopingEnabled = previewOptions.loop;
      if (previewOptions.bpm !== undefined) {
        this.beatsPerMinute = Math.max(30, Math.min(220, previewOptions.bpm));
      }
      if (previewOptions.highpassHz !== undefined) {
        this.highpassCutoffHz = previewOptions.highpassHz;
      }
      if (previewOptions.lowpassHz !== undefined) {
        this.lowpassCutoffHz = previewOptions.lowpassHz;
      }
    }

    this.getOrCreateAudioGraph();
    this.setHighpass(this.highpassCutoffHz);
    this.setLowpass(this.lowpassCutoffHz);
    this.setGain(this.outputGain);

    this.isCurrentlyPlaying = true;

    if (this.isLoopingEnabled) {
      this.nextBeatAudioTimeSec = ctx.currentTime;
      this.scheduleUpcomingBeats();
      this.schedulerIntervalId = setInterval(() => {
        this.scheduleUpcomingBeats();
      }, 25);
    } else {
      this.scheduleSingleVoice(ctx.currentTime);
    }
  }

  public stop(): void {
    if (this.schedulerIntervalId) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }

    if (this.activeSourceNodes.size > 0) {
      const nowSec = this.audioContext ? this.audioContext.currentTime : 0;
      if (this.masterGainNode && this.audioContext) {
        try {
          this.masterGainNode.gain.setValueAtTime(this.masterGainNode.gain.value, nowSec);
          this.masterGainNode.gain.linearRampToValueAtTime(0.0001, nowSec + 0.01);
        } catch {
          // Master gain node might already be disconnected
        }
      }

      for (const sourceNode of this.activeSourceNodes) {
        try {
          sourceNode.stop(nowSec + 0.015);
        } catch {
          // Source may already be stopped
        }
        sourceNode.disconnect();
      }
      this.activeSourceNodes.clear();
    }

    this.isCurrentlyPlaying = false;
  }

  public getIsPlaying(): boolean {
    return this.isCurrentlyPlaying;
  }

  public dispose(): void {
    this.stop();
    if (this.masterGainNode) {
      this.masterGainNode.disconnect();
      this.masterGainNode = null;
    }
    if (this.lowpassFilterNode) {
      this.lowpassFilterNode.disconnect();
      this.lowpassFilterNode = null;
    }
    if (this.highpassFilterNode) {
      this.highpassFilterNode.disconnect();
      this.highpassFilterNode = null;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
  }
}
