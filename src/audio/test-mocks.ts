import { vi } from 'vitest';

export class MockAudioParam {
  public value = 0;
  public setValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  public linearRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  public setValueCurveAtTime = vi.fn();
  public cancelScheduledValues = vi.fn();
}

export class MockAudioNode {
  public connect = vi.fn();
  public disconnect = vi.fn();
}

export class MockAudioBufferSourceNode extends MockAudioNode {
  public buffer: AudioBuffer | null = null;
  public loop = false;
  public playbackRate = new MockAudioParam();
  public onended: (() => void) | null = null;
  public start = vi.fn();
  public stop = vi.fn();
}

export class MockBiquadFilterNode extends MockAudioNode {
  public type: BiquadFilterType = 'lowpass';
  public frequency = new MockAudioParam();
}

export class MockGainNode extends MockAudioNode {
  public gain = new MockAudioParam();
}

export class MockDynamicsCompressorNode extends MockAudioNode {
  public threshold = new MockAudioParam();
  public knee = new MockAudioParam();
  public ratio = new MockAudioParam();
  public attack = new MockAudioParam();
  public release = new MockAudioParam();
}

export class MockAudioBuffer {
  public numberOfChannels: number;
  public length: number;
  public sampleRate: number;
  public duration: number;
  private readonly channelData: Float32Array;

  public constructor(channels = 1, length = 4410, sampleRate = 44100) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channelData = new Float32Array(length);
  }

  public getChannelData = vi.fn(() => this.channelData);
  public copyFromChannel = vi.fn();
  public copyToChannel = vi.fn();
}

export class MockAudioContext {
  public state: AudioContextState = 'running';
  public currentTime = 0;
  public sampleRate = 44100;
  public destination = new MockAudioNode();
  public createdSourceNodes: MockAudioBufferSourceNode[] = [];

  public resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });

  public close = vi.fn(() => {
    this.state = 'closed';
    return Promise.resolve();
  });

  public createBuffer(channels = 1, length = 4410, sampleRate = 44100): AudioBuffer {
    return new MockAudioBuffer(channels, length, sampleRate) as unknown as AudioBuffer;
  }

  public createBufferSource(): AudioBufferSourceNode {
    const src = new MockAudioBufferSourceNode();
    this.createdSourceNodes.push(src);
    return src as unknown as AudioBufferSourceNode;
  }

  public createBiquadFilter(): BiquadFilterNode {
    return new MockBiquadFilterNode() as unknown as BiquadFilterNode;
  }

  public createGain(): GainNode {
    return new MockGainNode() as unknown as GainNode;
  }

  public createDynamicsCompressor(): DynamicsCompressorNode {
    return new MockDynamicsCompressorNode() as unknown as DynamicsCompressorNode;
  }

  public decodeAudioData = vi.fn(() => {
    return Promise.resolve(this.createBuffer());
  });
}
