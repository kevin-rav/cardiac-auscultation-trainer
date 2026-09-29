import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTunerStore, setPreviewPlayerInstance, setCardiacPlayerInstance } from './tunerStore';
import type { AudioPreviewPlayer, CardiacAudioPlayer } from '../audio';

const playFn = vi.fn();
const stopFn = vi.fn();
const setBpmFn = vi.fn();

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
  setBpm: (bpm: number) => {
    setBpmFn(bpm);
  },
  loadSampleUrl: vi.fn().mockResolvedValue({}),
  loadAudioData: vi.fn().mockResolvedValue({}),
} as unknown as AudioPreviewPlayer;

const cardiacPlayFn = vi.fn();
const cardiacStopFn = vi.fn();
const cardiacSetBpmFn = vi.fn();
const cardiacSetSoundSetFn = vi.fn();

const mockCardiacPlayer = {
  play: () => {
    cardiacPlayFn();
    return Promise.resolve();
  },
  stop: () => {
    cardiacStopFn();
  },
  setSoundSet: (set: unknown) => {
    cardiacSetSoundSetFn(set);
  },
  setBpm: (bpm: number) => {
    cardiacSetBpmFn(bpm);
  },
  setVolume: vi.fn(),
  getSampleLoader: () => ({ preloadManifest: vi.fn().mockResolvedValue({}) }),
} as unknown as CardiacAudioPlayer;

describe('TunerStore', () => {
  beforeEach(() => {
    setPreviewPlayerInstance(mockPlayer);
    setCardiacPlayerInstance(mockCardiacPlayer);
    useTunerStore.setState({ playbackMode: 'full-cycle', isPlaying: false });
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
    store.setPlaybackMode('isolated');
    expect(store.isPlaying).toBe(false);

    store.play();
    expect(useTunerStore.getState().isPlaying).toBe(true);
    expect(playFn).toHaveBeenCalled();

    store.togglePlay();
    expect(useTunerStore.getState().isPlaying).toBe(false);
    expect(stopFn).toHaveBeenCalled();
  });

  it('manages BPM and clamps to valid clinical bounds (30-220)', () => {
    const store = useTunerStore.getState();
    expect(store.bpm).toBe(72);

    store.setBpm(85);
    expect(useTunerStore.getState().bpm).toBe(85);
    expect(setBpmFn).toHaveBeenCalledWith(85);

    // Below min
    store.setBpm(15);
    expect(useTunerStore.getState().bpm).toBe(30);
    expect(setBpmFn).toHaveBeenCalledWith(30);

    // Above max
    store.setBpm(300);
    expect(useTunerStore.getState().bpm).toBe(220);
    expect(setBpmFn).toHaveBeenCalledWith(220);
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

  it('loads clinical preset sound sets correctly', () => {
    const store = useTunerStore.getState();
    expect(store.presets.length).toBeGreaterThanOrEqual(6);

    store.loadPreset('s3-gallop');
    expect(useTunerStore.getState().soundSet.id).toBe('s3-gallop');
    expect(useTunerStore.getState().soundSet.events.length).toBe(3);
    expect(useTunerStore.getState().selectedEventIndex).toBe(0);

    store.loadPreset('aortic-stenosis');
    expect(useTunerStore.getState().soundSet.id).toBe('aortic-stenosis');
    expect(useTunerStore.getState().soundSet.events.length).toBe(3);
  });

  it('triggers CardiacAudioPlayer in full-cycle playback mode', () => {
    const store = useTunerStore.getState();
    expect(store.playbackMode).toBe('full-cycle');

    store.play();
    expect(cardiacPlayFn).toHaveBeenCalled();
    expect(playFn).not.toHaveBeenCalled();
    expect(useTunerStore.getState().isPlaying).toBe(true);

    store.stop();
    expect(cardiacStopFn).toHaveBeenCalled();
    expect(useTunerStore.getState().isPlaying).toBe(false);
  });

  it('triggers AudioPreviewPlayer in isolated sample playback mode', () => {
    const store = useTunerStore.getState();
    store.setPlaybackMode('isolated');
    expect(useTunerStore.getState().playbackMode).toBe('isolated');

    store.play();
    expect(playFn).toHaveBeenCalled();
    expect(useTunerStore.getState().isPlaying).toBe(true);

    store.stop();
    expect(stopFn).toHaveBeenCalled();
  });
});
