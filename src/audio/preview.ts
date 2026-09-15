export type TestSignalType = 'heart-beat' | 'click' | 'murmur';

export interface PreviewOptions {
  highpassHz?: number | undefined;
  lowpassHz?: number | undefined;
  gain?: number | undefined;
  playbackRate?: number | undefined;
  loop?: boolean | undefined;
}

export class AudioPreviewPlayer {
  private context: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private highpassNode: BiquadFilterNode | null = null;
  private lowpassNode: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;

  private currentBuffer: AudioBuffer | null = null;
  private isPlaying = false;
  private loop = false;
  private gain = 1;
  private playbackRate = 1;
  private highpassHz: number | undefined;
  private lowpassHz: number | undefined;

  private getContext(): AudioContext {
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    return this.context;
  }

  public async loadAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.getContext();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    this.currentBuffer = buffer;
    return buffer;
  }

  public setBuffer(buffer: AudioBuffer | null): void {
    this.currentBuffer = buffer;
  }

  public getBuffer(): AudioBuffer | null {
    return this.currentBuffer;
  }

  public generateSyntheticBuffer(type: TestSignalType): AudioBuffer {
    const ctx = this.getContext();
    const sampleRate = ctx.sampleRate;

    if (type === 'heart-beat') {
      // Damped low-frequency pulse (approx 60 Hz) simulating S1/S2
      const duration = 0.15;
      const length = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      const freq = 60;
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 28);
        data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.8;
      }
      this.currentBuffer = buffer;
      return buffer;
    }

    if (type === 'click') {
      // Short high-frequency click (approx 1200 Hz) simulating valvular click
      const duration = 0.05;
      const length = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      const freq = 1200;
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 80);
        data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.6;
      }
      this.currentBuffer = buffer;
      return buffer;
    }

    // Murmur: pink/turbulent noise burst (0.5s loopable)
    const duration = 0.6;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      const pink = b0 + b1 + b2 + white * 0.5362;
      data[i] = pink * 0.15;
    }
    this.currentBuffer = buffer;
    return buffer;
  }

  public setHighpass(hz?: number): void {
    this.highpassHz = hz;
    if (this.highpassNode && this.context) {
      if (hz !== undefined && hz > 0) {
        this.highpassNode.frequency.setValueAtTime(hz, this.context.currentTime);
      } else {
        // Bypass highpass by setting to minimum sub-audible frequency
        this.highpassNode.frequency.setValueAtTime(10, this.context.currentTime);
      }
    }
  }

  public setLowpass(hz?: number): void {
    this.lowpassHz = hz;
    if (this.lowpassNode && this.context) {
      if (hz !== undefined && hz > 0) {
        this.lowpassNode.frequency.setValueAtTime(hz, this.context.currentTime);
      } else {
        // Bypass lowpass by setting above Nyquist / audible range
        this.lowpassNode.frequency.setValueAtTime(22000, this.context.currentTime);
      }
    }
  }

  public setGain(gain: number): void {
    this.gain = gain;
    if (this.gainNode && this.context) {
      this.gainNode.gain.setValueAtTime(Math.max(0, gain), this.context.currentTime);
    }
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.sourceNode && this.context) {
      this.sourceNode.playbackRate.setValueAtTime(Math.max(0.1, rate), this.context.currentTime);
    }
  }

  public setLoop(loop: boolean): void {
    this.loop = loop;
    if (this.sourceNode) {
      this.sourceNode.loop = loop;
    }
  }

  public play(options?: PreviewOptions): void {
    const ctx = this.getContext();
    this.stop();

    if (!this.currentBuffer) {
      this.generateSyntheticBuffer('heart-beat');
    }

    if (!this.currentBuffer) {
      return;
    }

    if (options) {
      if (options.gain !== undefined) this.gain = options.gain;
      if (options.playbackRate !== undefined) this.playbackRate = options.playbackRate;
      if (options.loop !== undefined) this.loop = options.loop;
      if (options.highpassHz !== undefined) this.highpassHz = options.highpassHz;
      if (options.lowpassHz !== undefined) this.lowpassHz = options.lowpassHz;
    }

    const source = ctx.createBufferSource();
    source.buffer = this.currentBuffer;
    source.loop = this.loop;
    source.playbackRate.value = this.playbackRate;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value =
      this.highpassHz !== undefined && this.highpassHz > 0 ? this.highpassHz : 10;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value =
      this.lowpassHz !== undefined && this.lowpassHz > 0 ? this.lowpassHz : 22000;

    const gain = ctx.createGain();
    gain.gain.value = this.gain;

    // Signal chain: source -> highpass -> lowpass -> gain -> destination
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);

    source.onended = () => {
      if (!this.loop && this.sourceNode === source) {
        this.isPlaying = false;
        this.sourceNode = null;
      }
    };

    source.start(0);
    this.sourceNode = source;
    this.highpassNode = highpass;
    this.lowpassNode = lowpass;
    this.gainNode = gain;
    this.isPlaying = true;
  }

  public stop(): void {
    if (this.sourceNode) {
      try {
        if (this.gainNode && this.context) {
          // 10ms quick fade to avoid clicks
          const now = this.context.currentTime;
          this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
          this.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.01);
          this.sourceNode.stop(now + 0.015);
        } else {
          this.sourceNode.stop();
        }
      } catch {
        // Source may already be stopped
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.isPlaying = false;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public dispose(): void {
    this.stop();
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }
}
