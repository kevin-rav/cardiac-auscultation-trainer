export interface SpatialParameters {
  readonly gain?: number | undefined;
  readonly lowpassHz?: number | undefined;
  readonly pan?: number | undefined;
}

export class AudioGraph {
  public readonly masterGainNode: GainNode;
  public readonly spatialGainNode: GainNode;
  public readonly spatialFilterNode: BiquadFilterNode;
  public readonly pannerNode: StereoPannerNode | null;
  public readonly compressorNode: DynamicsCompressorNode;
  public readonly audioContext: AudioContext;

  public constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.masterGainNode = audioContext.createGain();

    // Soft-tissue acoustic lowpass absorption filter
    this.spatialFilterNode = audioContext.createBiquadFilter();
    this.spatialFilterNode.type = 'lowpass';
    this.spatialFilterNode.frequency.value = 20000;

    // Distance attenuation spatial gain node
    this.spatialGainNode = audioContext.createGain();
    this.spatialGainNode.gain.value = 1.0;

    // Subtle binaural/stereo panning across the chest wall
    this.pannerNode =
      typeof audioContext.createStereoPanner === 'function'
        ? audioContext.createStereoPanner()
        : null;

    this.compressorNode = audioContext.createDynamicsCompressor();

    // Configure compressor as a brickwall/safety limiter
    this.compressorNode.threshold.value = -1; // dB
    this.compressorNode.knee.value = 3; // dB
    this.compressorNode.ratio.value = 12;
    this.compressorNode.attack.value = 0.003; // seconds
    this.compressorNode.release.value = 0.1; // seconds

    // Signal chain: masterGain -> spatialFilter -> spatialGain -> panner -> compressor -> destination
    this.masterGainNode.connect(this.spatialFilterNode);
    this.spatialFilterNode.connect(this.spatialGainNode);

    if (this.pannerNode) {
      this.spatialGainNode.connect(this.pannerNode);
      this.pannerNode.connect(this.compressorNode);
    } else {
      this.spatialGainNode.connect(this.compressorNode);
    }

    this.compressorNode.connect(audioContext.destination);
  }

  /**
   * Sets master output volume with a smooth 20 ms linear ramp to prevent clicking.
   */
  public setVolume(volume: number, atTime?: number): void {
    const now = atTime ?? this.audioContext.currentTime;
    const safeVolume = Number.isFinite(volume) ? volume : 1;
    const clampedVolume = Math.max(0, Math.min(2, safeVolume));

    this.masterGainNode.gain.cancelScheduledValues(now);
    this.masterGainNode.gain.setValueAtTime(this.masterGainNode.gain.value, now);
    this.masterGainNode.gain.linearRampToValueAtTime(clampedVolume, now + 0.02);
  }

  public getVolume(): number {
    return this.masterGainNode.gain.value;
  }

  /**
   * Updates real-time spatial auscultation parameters (distance attenuation,
   * soft-tissue lowpass absorption, and stereo panning) with smooth 25ms transitions.
   */
  public setSpatialParameters(params: SpatialParameters, atTime?: number): void {
    const now = atTime ?? this.audioContext.currentTime;
    const rampDuration = 0.025;

    if (params.gain !== undefined && Number.isFinite(params.gain)) {
      const clampedGain = Math.max(0, Math.min(2, params.gain));
      this.spatialGainNode.gain.cancelScheduledValues(now);
      this.spatialGainNode.gain.setValueAtTime(this.spatialGainNode.gain.value, now);
      this.spatialGainNode.gain.linearRampToValueAtTime(clampedGain, now + rampDuration);
    }

    if (params.lowpassHz !== undefined && Number.isFinite(params.lowpassHz)) {
      const clampedHz = Math.max(100, Math.min(20000, params.lowpassHz));
      this.spatialFilterNode.frequency.cancelScheduledValues(now);
      this.spatialFilterNode.frequency.setValueAtTime(this.spatialFilterNode.frequency.value, now);
      this.spatialFilterNode.frequency.linearRampToValueAtTime(clampedHz, now + rampDuration);
    }

    if (this.pannerNode && params.pan !== undefined && Number.isFinite(params.pan)) {
      const clampedPan = Math.max(-1, Math.min(1, params.pan));
      this.pannerNode.pan.cancelScheduledValues(now);
      this.pannerNode.pan.setValueAtTime(this.pannerNode.pan.value, now);
      this.pannerNode.pan.linearRampToValueAtTime(clampedPan, now + rampDuration);
    }
  }

  public dispose(): void {
    try {
      this.masterGainNode.disconnect();
      this.spatialFilterNode.disconnect();
      this.spatialGainNode.disconnect();
      this.pannerNode?.disconnect();
      this.compressorNode.disconnect();
    } catch {
      // Node may already be disconnected
    }
  }
}
