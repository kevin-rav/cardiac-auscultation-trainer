import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPreviewPlayer } from './preview';
import { MockAudioContext, MockAudioBufferSourceNode } from './test-mocks';

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

  it('restores loaded custom audio buffer after synthetic sound is generated', async () => {
    expect(player.restoreCustomBuffer()).toBe(false);

    const fakeData = new ArrayBuffer(64);
    const buffer = await player.loadAudioData(fakeData);
    expect(player.getBuffer()).toBe(buffer);

    player.generateSyntheticBuffer('click');
    expect(player.getBuffer()).not.toBe(buffer);

    expect(player.restoreCustomBuffer()).toBe(true);
    expect(player.getBuffer()).toBe(buffer);
  });

  it('disposes player and closes context', () => {
    player.play();
    player.dispose();
    expect(player.getIsPlaying()).toBe(false);
  });

  it('calls onEnded when a non-looping sound finishes on its own', () => {
    const onEnded = vi.fn();
    const createSource = vi.spyOn(MockAudioContext.prototype, 'createBufferSource');
    player.play({ loop: false, onEnded });
    const source = createSource.mock.results[0]?.value as MockAudioBufferSourceNode;

    source.onended?.();
    expect(onEnded).toHaveBeenCalledOnce();
    expect(player.getIsPlaying()).toBe(false);
  });

  it('does not call onEnded for a looping sound or after stop()', () => {
    const onEnded = vi.fn();
    const createSource = vi.spyOn(MockAudioContext.prototype, 'createBufferSource');

    player.play({ loop: true, onEnded });
    const looping = createSource.mock.results[0]?.value as MockAudioBufferSourceNode;
    looping.onended?.();
    expect(player.getIsPlaying()).toBe(true);

    player.setLoop(false);
    player.stop();
    looping.onended?.();
    expect(onEnded).not.toHaveBeenCalled();
  });
});
