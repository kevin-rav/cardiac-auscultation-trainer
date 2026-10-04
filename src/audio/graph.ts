export class AudioGraph {
  public readonly masterGainNode: GainNode;
  public readonly compressorNode: DynamicsCompressorNode;
  public readonly audioContext: AudioContext;

  public constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.masterGainNode = audioContext.createGain();
    this.compressorNode = audioContext.createDynamicsCompressor();

    // Configure compressor as a brickwall/safety limiter
    this.compressorNode.threshold.value = -1; // dB
    this.compressorNode.knee.value = 3; // dB
    this.compressorNode.ratio.value = 12;
    this.compressorNode.attack.value = 0.003; // seconds
    this.compressorNode.release.value = 0.1; // seconds

    // Signal chain: masterGain -> compressor -> destination
    this.masterGainNode.connect(this.compressorNode);
    this.compressorNode.connect(audioContext.destination);
  }

  /**
   * Sets master output volume with a smooth 20 ms linear ramp to prevent clicking.
   */
  public setVolume(volume: number, atTime?: number): void {
    const now = atTime ?? this.audioContext.currentTime;
    const clampedVolume = Math.max(0, Math.min(2, volume));

    this.masterGainNode.gain.cancelScheduledValues(now);
    this.masterGainNode.gain.setValueAtTime(this.masterGainNode.gain.value, now);
    this.masterGainNode.gain.linearRampToValueAtTime(clampedVolume, now + 0.02);
  }

  public getVolume(): number {
    return this.masterGainNode.gain.value;
  }

  public dispose(): void {
    try {
      this.masterGainNode.disconnect();
      this.compressorNode.disconnect();
    } catch {
      // Node may already be disconnected
    }
  }
}
