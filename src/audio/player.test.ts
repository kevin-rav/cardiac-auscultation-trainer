import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SoundSet } from '../engine/schema';
import { CardiacAudioPlayer } from './player';

class MockAudioParam {
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

class MockDynamicsCompressorNode extends MockAudioNode {
  public threshold = new MockAudioParam();
  public knee = new MockAudioParam();
  public ratio = new MockAudioParam();
  public attack = new MockAudioParam();
  public release = new MockAudioParam();
}

class MockAudioBuffer {
  public numberOfChannels = 1;
  public length = 4410;
  public sampleRate = 44100;
  public duration = 0.1;
  public getChannelData = vi.fn(() => new Float32Array(4410));
}

class MockAudioContext {
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

  public createBuffer(): AudioBuffer {
    return new MockAudioBuffer() as unknown as AudioBuffer;
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

  public decodeAudioData = vi.fn(() =>
    Promise.resolve(new MockAudioBuffer() as unknown as AudioBuffer),
  );
}

describe('CardiacAudioPlayer', () => {
  let mockCtx: MockAudioContext;
  let player: CardiacAudioPlayer;

  const testSoundSet: SoundSet = {
    id: 'normal-s1-s2',
    label: 'Normal S1-S2',
    events: [
      {
        kind: 'transient',
        component: 'S1',
        sample: 's1-apex',
        at: { anchor: 'S1' },
        gain: 1.0,
        playbackRate: 1.0,
      },
      {
        kind: 'transient',
        component: 'S2',
        sample: 's2-base',
        at: { anchor: 'S2' },
        gain: 0.9,
        playbackRate: 1.0,
      },
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockCtx = new MockAudioContext();
    player = new CardiacAudioPlayer(
      testSoundSet,
      undefined,
      undefined,
      mockCtx as unknown as AudioContext,
    );

    // Provide mock audio buffers for s1-apex and s2-base
    const loader = player.getSampleLoader();
    loader.setBuffer('s1-apex', new MockAudioBuffer() as unknown as AudioBuffer);
    loader.setBuffer('s2-base', new MockAudioBuffer() as unknown as AudioBuffer);
  });

  afterEach(() => {
    player.dispose();
    vi.useRealTimers();
  });

  it('initializes with paused state and correct defaults', () => {
    expect(player.getIsPlaying()).toBe(false);
    expect(player.getBpm()).toBe(72);
    expect(player.getVolume()).toBe(1);
  });

  it('starts lookahead playback and triggers voice source nodes', async () => {
    await player.play();
    expect(player.getIsPlaying()).toBe(true);

    // Initial tick should have triggered voices for the first beat
    expect(mockCtx.createdSourceNodes.length).toBeGreaterThanOrEqual(1);

    const firstSource = mockCtx.createdSourceNodes[0];
    expect(firstSource).toBeDefined();
    expect(firstSource?.start).toHaveBeenCalled();
  });

  it('stops all active voices cleanly with gain ramp', async () => {
    await player.play();
    expect(player.getIsPlaying()).toBe(true);

    player.stop();
    expect(player.getIsPlaying()).toBe(false);

    // Advance timers past the 15 ms stop window
    vi.advanceTimersByTime(25);
    for (const source of mockCtx.createdSourceNodes) {
      expect(source.stop).toHaveBeenCalled();
    }
  });

  it('updates BPM dynamically without throwing or resetting state', async () => {
    await player.play();
    player.setBpm(120);
    expect(player.getBpm()).toBe(120);
    expect(player.getIsPlaying()).toBe(true);
  });
});
