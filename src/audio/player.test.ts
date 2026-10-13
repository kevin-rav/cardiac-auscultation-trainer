import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SoundSet } from '../engine/schema';
import { CardiacAudioPlayer } from './player';
import { MockAudioBuffer, MockAudioContext } from './test-mocks';

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
