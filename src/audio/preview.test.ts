import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPreviewPlayer } from './preview';

class MockAudioParam {
  public value = 0;
  public setValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  public linearRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  public cancelScheduledValues = vi.fn();
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

  afterEach(() => {
    player.stop();
  });

  it('loads sample from URL and caches decoded buffer', async () => {
    const fakeBuffer = new ArrayBuffer(64);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(fakeBuffer),
      }),
    );

    const buffer = await player.loadSampleUrl('/sounds/s1-apex.wav');
    expect(buffer).toBeDefined();
    expect(player.getBuffer()).toBe(buffer);

    // Second call should return cached buffer without fetching again
    const cached = await player.loadSampleUrl('/sounds/s1-apex.wav');
    expect(cached).toBe(buffer);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('starts audio graph on play with filter and gain settings', () => {
    player.play({
      highpassHz: 120,
      lowpassHz: 2500,
      gain: 1.5,
      playbackRate: 1.1,
      loop: true,
      bpm: 80,
    });

    expect(player.getIsPlaying()).toBe(true);
    expect(player.getBpm()).toBe(80);
    expect(player.getLoop()).toBe(true);

    player.setHighpass(180);
    player.setLowpass(3000);
    player.setGain(2.0);
    player.setPlaybackRate(1.2);
  });

  it('clamps BPM within clinical bounds (30 to 220)', () => {
    player.setBpm(20);
    expect(player.getBpm()).toBe(30);

    player.setBpm(300);
    expect(player.getBpm()).toBe(220);

    player.setBpm(75);
    expect(player.getBpm()).toBe(75);
  });

  it('supports dynamically enabling and disabling loop mode', () => {
    player.play({ loop: false });
    expect(player.getLoop()).toBe(false);

    player.setLoop(true);
    expect(player.getLoop()).toBe(true);

    player.setLoop(false);
    expect(player.getLoop()).toBe(false);
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
