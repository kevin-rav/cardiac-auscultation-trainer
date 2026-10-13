import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTunerStore, setPlayerInstance } from './tunerStore';
import type { CardiacAudioPlayer } from '../audio';
import type { SoundSet } from '../engine/schema';

const playFn = vi.fn();
const stopFn = vi.fn();
const setLoopFn = vi.fn();
const setBpmFn = vi.fn();
const setSoundSetFn = vi.fn();
const setOnEndedFn = vi.fn();
const loadAudioDataFn = vi.fn();

const mockPlayer = {
  play: () => {
    playFn();
    return Promise.resolve();
  },
  stop: () => {
    stopFn();
  },
  setSoundSet: (set: unknown) => {
    setSoundSetFn(set);
  },
  setBpm: (bpm: number) => {
    setBpmFn(bpm);
  },
  setLoop: (loop: boolean) => {
    setLoopFn(loop);
  },
  setOnEnded: (callback?: () => void) => {
    setOnEndedFn(callback);
  },
  setVolume: vi.fn(),
  loadAudioData: async (id: string, buf: ArrayBuffer): Promise<void> => {
    await loadAudioDataFn(id, buf);
  },
  getSampleLoader: () => ({
    preloadManifest: vi.fn().mockResolvedValue({}),
    setBuffer: vi.fn(),
    getBuffer: vi.fn(),
  }),
} as unknown as CardiacAudioPlayer;

const initialState = useTunerStore.getState();

describe('TunerStore', () => {
  beforeEach(() => {
    useTunerStore.setState(initialState, true);
    setPlayerInstance(mockPlayer);
    useTunerStore.setState({ playbackMode: 'full-cycle', isPlaying: false });
    vi.clearAllMocks();
    loadAudioDataFn.mockResolvedValue({});
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

  it('applies selected event gain, playback rate, and filters during active playback', () => {
    const store = useTunerStore.getState();
    store.setPlaybackMode('isolated');
    store.play();
    expect(useTunerStore.getState().isPlaying).toBe(true);

    setSoundSetFn.mockClear();

    // Default S2 has gain: 0.9, playbackRate: 1, highpassHz: 100, lowpassHz: 1500
    store.selectEvent(1);
    expect(useTunerStore.getState().selectedEventIndex).toBe(1);

    expect(setSoundSetFn).toHaveBeenCalled();
    const updatedSet = setSoundSetFn.mock.lastCall?.[0] as SoundSet;
    expect(updatedSet.events[0]?.component).toBe('S2');
    expect(updatedSet.events[0]?.gain).toBe(0.9);
  });

  it('does not update player during event selection when audio is not playing', () => {
    const store = useTunerStore.getState();
    expect(store.isPlaying).toBe(false);

    setSoundSetFn.mockClear();
    store.selectEvent(1);
    expect(useTunerStore.getState().selectedEventIndex).toBe(1);
    expect(setSoundSetFn).not.toHaveBeenCalled();
  });

  it('syncs player parameters when adding or removing events during playback', () => {
    const store = useTunerStore.getState();
    store.setPlaybackMode('isolated');
    store.play();

    setSoundSetFn.mockClear();
    store.addEvent('murmur');
    expect(setSoundSetFn).toHaveBeenCalled();

    setSoundSetFn.mockClear();
    store.removeEvent(useTunerStore.getState().selectedEventIndex);
    expect(setSoundSetFn).toHaveBeenCalled();
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

  it('flags validation error and blocks setting highpass cutoff greater than or equal to lowpass', () => {
    const store = useTunerStore.getState();
    const prevHp = store.soundSet.events[0]?.filter?.highpassHz;
    const prevLp = store.soundSet.events[0]?.filter?.lowpassHz;

    store.setFilter({ highpassHz: 1200, lowpassHz: 200 });
    expect(useTunerStore.getState().validationError).toMatch(/lower than lowpass/i);
    expect(useTunerStore.getState().soundSet.events[0]?.filter?.highpassHz).toBe(prevHp);
    expect(useTunerStore.getState().soundSet.events[0]?.filter?.lowpassHz).toBe(prevLp);

    // Resolves error when valid cutoffs are set
    store.setFilter({ highpassHz: 80, lowpassHz: 1200 });
    expect(useTunerStore.getState().validationError).toBeNull();
  });

  it('toggles playback and calls player', () => {
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

    const crossedCutoffsJson = JSON.stringify({
      id: 'crossed-filters',
      label: 'Crossed Filter Test',
      events: [
        {
          kind: 'transient',
          component: 'S1',
          sample: 's1-apex',
          at: { anchor: 'S1' },
          filter: { highpassHz: 1500, lowpassHz: 500 },
        },
      ],
    });
    const crossedSuccess = store.importJson(crossedCutoffsJson);
    expect(crossedSuccess).toBe(false);
    expect(useTunerStore.getState().validationError).toMatch(/lower than lowpass/i);
  });

  it('marks playback stopped when a non-looping sound ends on its own', () => {
    const store = useTunerStore.getState();
    store.setPlaybackMode('isolated');
    store.setLoop(false);
    store.play();
    expect(useTunerStore.getState().isPlaying).toBe(true);

    expect(setOnEndedFn).toHaveBeenCalled();
    const onEnded = setOnEndedFn.mock.lastCall?.[0] as (() => void) | undefined;
    onEnded?.();
    expect(useTunerStore.getState().isPlaying).toBe(false);
  });

  it('passes loop changes to the player', () => {
    useTunerStore.getState().setLoop(true);
    expect(useTunerStore.getState().loop).toBe(true);
    expect(setLoopFn).toHaveBeenCalledWith(true);
  });

  it('updates the sound set on signal source change and updates player if playing', () => {
    const store = useTunerStore.getState();
    store.setPlaybackMode('isolated');
    store.setSignalSource('click');
    expect(playFn).not.toHaveBeenCalled();

    store.play();
    setSoundSetFn.mockClear();
    store.setSignalSource('murmur-noise');
    expect(useTunerStore.getState().signalSource).toBe('murmur-noise');
    expect(setSoundSetFn).toHaveBeenCalled();
  });

  it('switches to the custom source after decoding an uploaded file', async () => {
    await useTunerStore.getState().loadCustomAudio('s1.wav', new ArrayBuffer(8));
    const state = useTunerStore.getState();
    expect(state.signalSource).toBe('custom');
    expect(state.customFileName).toBe('s1.wav');
    expect(state.audioError).toBeNull();
  });

  it('does not play and stops if custom source selected without an uploaded file', () => {
    const store = useTunerStore.getState();
    store.setPlaybackMode('isolated');
    store.play();
    expect(useTunerStore.getState().isPlaying).toBe(true);

    store.setSignalSource('custom');
    expect(useTunerStore.getState().signalSource).toBe('custom');
    expect(useTunerStore.getState().isPlaying).toBe(false);
    expect(stopFn).toHaveBeenCalled();

    playFn.mockClear();
    store.play();
    expect(playFn).not.toHaveBeenCalled();
    expect(useTunerStore.getState().isPlaying).toBe(false);
  });

  it('resumes playback if custom file was loaded', async () => {
    await useTunerStore.getState().loadCustomAudio('s1.wav', new ArrayBuffer(8));
    const store = useTunerStore.getState();
    store.setPlaybackMode('isolated');
    store.play();
    expect(useTunerStore.getState().isPlaying).toBe(true);

    setSoundSetFn.mockClear();
    store.setSignalSource('click');
    expect(setSoundSetFn).toHaveBeenCalled();

    setSoundSetFn.mockClear();
    store.setSignalSource('custom');
    expect(setSoundSetFn).toHaveBeenCalled();
  });

  it('reports an error and keeps the current source when decoding fails', async () => {
    loadAudioDataFn.mockRejectedValueOnce(new Error('Unable to decode'));
    await useTunerStore.getState().loadCustomAudio('notes.txt', new ArrayBuffer(8));
    const state = useTunerStore.getState();
    expect(state.signalSource).toBe('event-sample');
    expect(state.customFileName).toBeNull();
    expect(state.audioError).toBe('Could not decode notes.txt: Unable to decode');
  });

  it('sanitizes the set id and keeps the old id when the field is cleared', () => {
    const store = useTunerStore.getState();
    store.updateSoundSetMetadata('Label', 'My Set_2');
    expect(useTunerStore.getState().soundSet.id).toBe('my-set-2');

    useTunerStore.getState().updateSoundSetMetadata('Label', '');
    expect(useTunerStore.getState().soundSet.id).toBe('my-set-2');
  });

  it('flags an empty label because the export would not import back', () => {
    const store = useTunerStore.getState();
    store.updateSoundSetMetadata('', store.soundSet.id);
    const state = useTunerStore.getState();
    expect(state.soundSet.label).toBe('');
    expect(state.validationError).toMatch(/^label:/);
    expect(state.importJson(state.exportJson())).toBe(false);

    useTunerStore.getState().updateSoundSetMetadata('Fixed', state.soundSet.id);
    expect(useTunerStore.getState().validationError).toBeNull();
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
    expect(playFn).toHaveBeenCalled();
    expect(useTunerStore.getState().isPlaying).toBe(true);

    store.stop();
    expect(stopFn).toHaveBeenCalled();
    expect(useTunerStore.getState().isPlaying).toBe(false);
  });

  it('triggers CardiacAudioPlayer with isolated sound set in isolated mode', () => {
    const store = useTunerStore.getState();
    store.setPlaybackMode('isolated');
    expect(useTunerStore.getState().playbackMode).toBe('isolated');

    setSoundSetFn.mockClear();
    store.play();
    expect(playFn).toHaveBeenCalled();
    expect(setSoundSetFn).toHaveBeenCalled();
    const set = setSoundSetFn.mock.lastCall?.[0] as SoundSet;
    expect(set.events.length).toBe(1);

    store.stop();
    expect(stopFn).toHaveBeenCalled();
  });

  it('syncs sound set changes immediately to cardiac player and applies changes', () => {
    const store = useTunerStore.getState();
    store.setGain(2.2);
    expect(setSoundSetFn).toHaveBeenCalled();

    store.play();
    store.applyChanges();
    expect(playFn).toHaveBeenCalled();
  });
});
