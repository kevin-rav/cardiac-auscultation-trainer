import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTunerStore, setPreviewPlayerInstance } from './tunerStore';
import type { AudioPreviewPlayer } from '../audio';

const playFn = vi.fn();
const stopFn = vi.fn();

const mockPlayer = {
  play: () => {
    playFn();
  },
  stop: () => {
    stopFn();
  },
  setGain: vi.fn(),
  setPlaybackRate: vi.fn(),
  setHighpass: vi.fn(),
  setLowpass: vi.fn(),
  setLoop: vi.fn(),
  generateSyntheticBuffer: vi.fn(),
  loadAudioData: vi.fn().mockResolvedValue({}),
} as unknown as AudioPreviewPlayer;

describe('TunerStore', () => {
  beforeEach(() => {
    setPreviewPlayerInstance(mockPlayer);
    vi.clearAllMocks();
  });

  it('has initial default sound set with S1 and S2 events', () => {
    const state = useTunerStore.getState();
    expect(state.soundSet.id).toBe('normal-s1-s2');
    expect(state.soundSet.events.length).toBe(2);
    expect(state.selectedEventIndex).toBe(0);
  });

  it('selects events within valid bounds', () => {
    const store = useTunerStore.getState();
    store.selectEvent(1);
    expect(useTunerStore.getState().selectedEventIndex).toBe(1);

    // Out of bounds should not change index
    store.selectEvent(99);
    expect(useTunerStore.getState().selectedEventIndex).toBe(1);
  });

  it('adds transient and murmur events', () => {
    const store = useTunerStore.getState();
    store.addEvent('transient');
    expect(useTunerStore.getState().soundSet.events.length).toBe(3);
    expect(useTunerStore.getState().selectedEventIndex).toBe(2);

    store.addEvent('murmur');
    expect(useTunerStore.getState().soundSet.events.length).toBe(4);
    expect(useTunerStore.getState().selectedEventIndex).toBe(3);
  });

  it('removes event and prevents removing the last remaining event', () => {
    const store = useTunerStore.getState();
    const initialCount = store.soundSet.events.length;
    store.removeEvent(initialCount - 1);
    expect(useTunerStore.getState().soundSet.events.length).toBe(initialCount - 1);

    // Keep removing until 1 remains
    while (useTunerStore.getState().soundSet.events.length > 1) {
      useTunerStore.getState().removeEvent(0);
    }
    expect(useTunerStore.getState().soundSet.events.length).toBe(1);

    // Trying to remove last event should set validationError
    useTunerStore.getState().removeEvent(0);
    expect(useTunerStore.getState().soundSet.events.length).toBe(1);
    expect(useTunerStore.getState().validationError).toContain('at least one event');
  });

  it('updates filter, gain, and playback rate for selected event', () => {
    const store = useTunerStore.getState();
    store.setFilter({ highpassHz: 150, lowpassHz: 1800 });
    const current = useTunerStore.getState().soundSet.events[0];
    expect(current?.filter?.highpassHz).toBe(150);
    expect(current?.filter?.lowpassHz).toBe(1800);

    store.setGain(2.5);
    expect(useTunerStore.getState().soundSet.events[0]?.gain).toBe(2.5);

    store.setPlaybackRate(1.3);
    const updated = useTunerStore.getState().soundSet.events[0];
    if (updated?.kind === 'transient') {
      expect(updated.playbackRate).toBe(1.3);
    }
  });

  it('toggles playback and calls preview player', () => {
    const store = useTunerStore.getState();
    expect(store.isPlaying).toBe(false);

    store.play();
    expect(useTunerStore.getState().isPlaying).toBe(true);
    expect(playFn).toHaveBeenCalled();

    store.togglePlay();
    expect(useTunerStore.getState().isPlaying).toBe(false);
    expect(stopFn).toHaveBeenCalled();
  });

  it('exports and imports valid JSON correctly', () => {
    const store = useTunerStore.getState();
    const json = store.exportJson();
    expect(json).toContain('normal-s1-s2');

    const validNewJson = JSON.stringify({
      id: 'custom-murmur',
      label: 'Custom Systolic Murmur',
      events: [
        {
          kind: 'murmur',
          component: 'systolicMurmur',
          sample: 'murmur-noise',
          from: { anchor: 'S1', fraction: 0.1 },
          to: { anchor: 'S2' },
          shape: 'diamond',
          gain: 1.5,
          edgeMs: 20,
        },
      ],
    });

    const success = store.importJson(validNewJson);
    expect(success).toBe(true);
    expect(useTunerStore.getState().soundSet.id).toBe('custom-murmur');
    expect(useTunerStore.getState().soundSet.events.length).toBe(1);
  });

  it('handles invalid JSON import gracefully', () => {
    const store = useTunerStore.getState();
    const success = store.importJson('not valid json');
    expect(success).toBe(false);
    expect(useTunerStore.getState().validationError).toBeTruthy();

    const invalidSchemaJson = JSON.stringify({
      id: 'bad',
      events: [], // Invalid: min 1 event
    });
    const schemaSuccess = store.importJson(invalidSchemaJson);
    expect(schemaSuccess).toBe(false);
    expect(useTunerStore.getState().validationError).toBeTruthy();
  });
});
