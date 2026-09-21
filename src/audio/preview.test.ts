import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPreviewPlayer } from './preview';

class MockAudioParam {
  public value = 0;
  public setValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  public linearRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
}

class MockAudioNode {
  public connect = vi.fn();
  public disconnect = vi.fn();
}

class MockAudioBufferSourceNode extends MockAudioNode {
  public buffer: AudioBuffer | null = null;
  public loop = false;
  public playbackRate = new MockAudioParam();
  public onended: (() => void) | null = null;
  public start = vi.fn();
  public stop = vi.fn();
}

class MockBiquadFilterNode extends MockAudioNode {
  public type: BiquadFilterType = 'lowpass';
  public frequency = new MockAudioParam();
}

class MockGainNode extends MockAudioNode {
  public gain = new MockAudioParam();
}

class MockAudioBuffer {
  public numberOfChannels: number;
  public length: number;
  public sampleRate: number;
  public duration: number;
  private channelData: Float32Array;

  constructor(channels: number, length: number, sampleRate: number) {
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

class MockAudioContext {
  public state: AudioContextState = 'running';
  public currentTime = 0;
  public sampleRate = 44100;
  public destination = new MockAudioNode();

  public resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });

  public close = vi.fn(() => {
    this.state = 'closed';
    return Promise.resolve();
  });

  public createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    return new MockAudioBuffer(channels, length, sampleRate) as unknown as AudioBuffer;
  }

  public createBufferSource(): AudioBufferSourceNode {
    return new MockAudioBufferSourceNode() as unknown as AudioBufferSourceNode;
  }

  public createBiquadFilter(): BiquadFilterNode {
    return new MockBiquadFilterNode() as unknown as BiquadFilterNode;
  }

  public createGain(): GainNode {
    return new MockGainNode() as unknown as GainNode;
  }

  public decodeAudioData = vi.fn(() => {
    return Promise.resolve(this.createBuffer(1, 1000, 44100));
  });
}

describe('AudioPreviewPlayer', () => {
  let player: AudioPreviewPlayer;

  beforeEach(() => {
    vi.stubGlobal('AudioContext', MockAudioContext);
    player = new AudioPreviewPlayer();
  });

  it('generates synthetic heart sound buffers', () => {
    const heartbeat = player.generateSyntheticBuffer('heart-beat');
    expect(heartbeat).toBeDefined();
    expect(heartbeat.numberOfChannels).toBe(1);

    const click = player.generateSyntheticBuffer('click');
    expect(click).toBeDefined();

    const murmur = player.generateSyntheticBuffer('murmur');
    expect(murmur).toBeDefined();
  });

  it('starts audio graph on play with filter and gain settings', () => {
    player.play({
      highpassHz: 120,
      lowpassHz: 2500,
      gain: 1.5,
      playbackRate: 1.1,
      loop: true,
    });

    expect(player.getIsPlaying()).toBe(true);

    player.setHighpass(180);
    player.setLowpass(3000);
    player.setGain(2.0);
    player.setPlaybackRate(1.2);
  });

  it('stops and disconnects gracefully', () => {
    player.play();
    expect(player.getIsPlaying()).toBe(true);

    player.stop();
    expect(player.getIsPlaying()).toBe(false);
  });

  it('decodes audio data and sets current buffer', async () => {
    const fakeData = new ArrayBuffer(64);
    const buffer = await player.loadAudioData(fakeData);
    expect(buffer).toBeDefined();
    expect(player.getBuffer()).toBe(buffer);
  });

  it('disposes player and closes context', () => {
    player.play();
    player.dispose();
    expect(player.getIsPlaying()).toBe(false);
  });
});
