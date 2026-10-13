import { create } from 'zustand';
import { CardiacAudioPlayer } from '../audio';
import {
  SoundSetSchema,
  type SoundEvent,
  type SoundSet,
  type Filter,
  type Component,
  type MurmurShape,
} from '../engine/schema';
import { PRESET_SOUND_SETS, manifest } from '../data';

export type { SoundEvent, SoundSet, Filter, Component, MurmurShape };

export type SampleSource =
  'event-sample' | 's1-apex' | 's2-base' | 's3' | 's4' | 'click' | 'murmur-noise' | 'custom';

export type SignalSource = SampleSource;
export type PlaybackMode = 'full-cycle' | 'isolated';

export interface TunerState {
  soundSet: SoundSet;
  selectedEventIndex: number;
  isPlaying: boolean;
  loop: boolean;
  bpm: number;
  playbackMode: PlaybackMode;
  signalSource: SignalSource;
  customFileName: string | null;
  validationError: string | null;
  audioError: string | null;

  // Actions
  selectEvent: (index: number) => void;
  updateEvent: (index: number, updated: SoundEvent) => void;
  addEvent: (kind: 'transient' | 'murmur') => void;
  removeEvent: (index: number) => void;
  updateSoundSetMetadata: (label: string, id?: string, description?: string) => void;

  setFilter: (filter: Filter) => void;
  setGain: (gain: number) => void;
  setPlaybackRate: (rate: number) => void;
  setLoop: (loop: boolean) => void;
  setBpm: (bpm: number) => void;
  setSignalSource: (source: SignalSource) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;

  loadCustomAudio: (name: string, arrayBuffer: ArrayBuffer) => Promise<void>;
  play: () => void;
  stop: () => void;
  togglePlay: () => void;

  exportJson: () => string;
  importJson: (jsonString: string) => boolean;

  applyChanges: () => void;

  presets: readonly SoundSet[];
  loadPreset: (id: string) => void;
}

const defaultSoundSet: SoundSet = {
  id: 'normal-s1-s2',
  label: 'Normal S1-S2 Heart Sound',
  description: 'Standard physiological heart sounds with configurable filters',
  events: [
    {
      kind: 'transient',
      component: 'S1',
      sample: 's1-apex',
      at: { anchor: 'S1' },
      gain: 1,
      playbackRate: 1,
      filter: { highpassHz: 80, lowpassHz: 1200 },
    },
    {
      kind: 'transient',
      component: 'S2',
      sample: 's2-base',
      at: { anchor: 'S2' },
      gain: 0.9,
      playbackRate: 1,
      filter: { highpassHz: 100, lowpassHz: 1500 },
    },
  ],
};

function formatIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`).join(', ');
}

let cardiacPlayer: CardiacAudioPlayer | null = null;

function getPlayer(): CardiacAudioPlayer {
  if (!cardiacPlayer) {
    cardiacPlayer = new CardiacAudioPlayer(useTunerStore.getState().soundSet, undefined, manifest);
    void cardiacPlayer.getSampleLoader().preloadManifest(manifest);
  }
  return cardiacPlayer;
}

export function setPlayerInstance(player: CardiacAudioPlayer | null): void {
  cardiacPlayer = player;
}

export const setCardiacPlayerInstance = setPlayerInstance;
export const setPreviewPlayerInstance = setPlayerInstance;

function getActiveSoundSet(state: TunerState): SoundSet {
  const { soundSet, selectedEventIndex, playbackMode, signalSource } = state;
  if (playbackMode === 'full-cycle') {
    return soundSet;
  }
  const current = soundSet.events[selectedEventIndex] ?? soundSet.events[0];
  if (!current) {
    return soundSet;
  }
  const sampleOverride =
    signalSource === 'event-sample' || signalSource === 'custom' ? current.sample : signalSource;
  const isolatedEvent: SoundEvent = { ...current, sample: sampleOverride };
  return {
    ...soundSet,
    events: [isolatedEvent],
  };
}

function syncPlayer(state: TunerState): void {
  if (cardiacPlayer) {
    cardiacPlayer.setBpm(state.bpm);
    cardiacPlayer.setLoop(state.loop);
    cardiacPlayer.setSoundSet(getActiveSoundSet(state));
  }
}

export const useTunerStore = create<TunerState>((set, get) => ({
  soundSet: defaultSoundSet,
  selectedEventIndex: 0,
  isPlaying: false,
  loop: true,
  bpm: 72,
  playbackMode: 'full-cycle',
  signalSource: 'event-sample',
  customFileName: null,
  validationError: null,
  audioError: null,

  selectEvent: (index) => {
    const { soundSet, isPlaying } = get();
    if (index >= 0 && index < soundSet.events.length) {
      set({ selectedEventIndex: index });
      if (isPlaying) {
        syncPlayer(get());
      }
    }
  },

  updateEvent: (index, updated) => {
    const { soundSet } = get();
    if (index < 0 || index >= soundSet.events.length) return;

    const nextEvents = [...soundSet.events];
    nextEvents[index] = updated;

    const updatedSoundSet: SoundSet = {
      ...soundSet,
      events: nextEvents,
    };

    const validated = SoundSetSchema.safeParse(updatedSoundSet);
    set({
      soundSet: updatedSoundSet,
      validationError: validated.success ? null : formatIssues(validated.error.issues),
    });

    syncPlayer(get());
  },

  addEvent: (kind) => {
    const { soundSet } = get();
    const newEvent: SoundEvent =
      kind === 'transient'
        ? {
            kind: 'transient',
            component: 'click',
            sample: 'click',
            at: { anchor: 'S1', fraction: 0.5 },
            gain: 1,
            playbackRate: 1,
          }
        : {
            kind: 'murmur',
            component: 'systolicMurmur',
            sample: 'murmur-noise',
            from: { anchor: 'S1', fraction: 0.1 },
            to: { anchor: 'S2' },
            shape: 'plateau',
            gain: 0.8,
            edgeMs: 15,
          };

    const nextEvents = [...soundSet.events, newEvent];
    const nextIndex = nextEvents.length - 1;
    const updatedSoundSet: SoundSet = { ...soundSet, events: nextEvents };

    set({
      soundSet: updatedSoundSet,
      selectedEventIndex: nextIndex,
      validationError: null,
    });

    syncPlayer(get());
  },

  removeEvent: (index) => {
    const { soundSet, selectedEventIndex } = get();
    if (soundSet.events.length <= 1) {
      set({ validationError: 'A sound set must contain at least one event.' });
      return;
    }

    const nextEvents = soundSet.events.filter((_, i) => i !== index);
    const nextIndex = Math.min(selectedEventIndex, nextEvents.length - 1);
    const resolvedIndex = Math.max(0, nextIndex);
    const updatedSoundSet: SoundSet = { ...soundSet, events: nextEvents };

    set({
      soundSet: updatedSoundSet,
      selectedEventIndex: resolvedIndex,
      validationError: null,
    });

    syncPlayer(get());
  },

  updateSoundSetMetadata: (label, id, description) => {
    const { soundSet } = get();
    const cleanId = id ? id.toLowerCase().replace(/[^a-z0-9-]/g, '-') : soundSet.id;
    const updatedSoundSet: SoundSet = {
      ...soundSet,
      id: cleanId,
      label,
      ...(description !== undefined ? { description } : {}),
    };

    const validated = SoundSetSchema.safeParse(updatedSoundSet);
    set({
      soundSet: updatedSoundSet,
      validationError: validated.success ? null : formatIssues(validated.error.issues),
    });

    syncPlayer(get());
  },

  setFilter: (filter) => {
    const { soundSet, selectedEventIndex, updateEvent } = get();
    const current = soundSet.events[selectedEventIndex];
    if (!current) return;

    const nextHp = filter.highpassHz ?? current.filter?.highpassHz;
    const nextLp = filter.lowpassHz ?? current.filter?.lowpassHz;
    if (nextHp !== undefined && nextLp !== undefined && nextHp >= nextLp) {
      set({ validationError: 'highpass cutoff must be lower than lowpass cutoff' });
      return;
    }

    const nextFilter = {
      ...(filter.highpassHz !== undefined ? { highpassHz: filter.highpassHz } : {}),
      ...(filter.lowpassHz !== undefined ? { lowpassHz: filter.lowpassHz } : {}),
    };

    const updated = { ...current, filter: nextFilter } as SoundEvent;
    updateEvent(selectedEventIndex, updated);
  },

  setGain: (gain) => {
    const { soundSet, selectedEventIndex, updateEvent } = get();
    const current = soundSet.events[selectedEventIndex];
    if (!current) return;

    updateEvent(selectedEventIndex, { ...current, gain });
  },

  setPlaybackRate: (playbackRate) => {
    const { soundSet, selectedEventIndex, updateEvent } = get();
    const current = soundSet.events[selectedEventIndex];
    if (current?.kind !== 'transient') return;

    updateEvent(selectedEventIndex, {
      ...current,
      playbackRate,
    });
  },

  setLoop: (loop) => {
    set({ loop });
    getPlayer().setLoop(loop);
  },

  setBpm: (bpm) => {
    const clamped = Math.max(30, Math.min(220, Math.round(bpm)));
    set({ bpm: clamped });
    getPlayer().setBpm(clamped);
  },

  setPlaybackMode: (mode) => {
    const wasPlaying = get().isPlaying;
    if (wasPlaying) {
      get().stop();
    }
    set({ playbackMode: mode });
    if (wasPlaying) {
      get().play();
    }
  },

  setSignalSource: (source) => {
    set({ signalSource: source, audioError: null });
    if (source === 'custom' && !get().customFileName) {
      if (get().isPlaying) {
        get().stop();
      }
      return;
    }
    syncPlayer(get());
    if (get().isPlaying) {
      get().play();
    }
  },

  loadCustomAudio: async (name, arrayBuffer) => {
    const player = getPlayer();
    try {
      await player.loadAudioData('custom', arrayBuffer);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      set({ audioError: `Could not decode ${name}: ${reason}` });
      return;
    }
    set({
      signalSource: 'custom',
      customFileName: name,
      audioError: null,
    });
    syncPlayer(get());
    if (get().isPlaying) {
      get().play();
    }
  },

  play: () => {
    const { playbackMode, signalSource, customFileName } = get();
    if (playbackMode === 'isolated' && signalSource === 'custom' && !customFileName) {
      return;
    }

    const player = getPlayer();
    syncPlayer(get());
    player.setOnEnded(() => {
      set({ isPlaying: false });
    });
    void player.play();
    set({ isPlaying: true });
  },

  stop: () => {
    getPlayer().stop();
    set({ isPlaying: false });
  },

  togglePlay: () => {
    const { isPlaying, play, stop } = get();
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  },

  exportJson: () => {
    const { soundSet } = get();
    return JSON.stringify(soundSet, null, 2);
  },

  importJson: (jsonString) => {
    try {
      const parsed: unknown = JSON.parse(jsonString);
      const validated = SoundSetSchema.safeParse(parsed);

      if (!validated.success) {
        set({ validationError: formatIssues(validated.error.issues) });
        return false;
      }

      set({
        soundSet: validated.data,
        selectedEventIndex: 0,
        validationError: null,
      });

      syncPlayer(get());
      getPlayer().stop();
      set({ isPlaying: false });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JSON formatting';
      set({ validationError: message });
      return false;
    }
  },

  applyChanges: () => {
    const { isPlaying } = get();
    syncPlayer(get());
    if (isPlaying) {
      const player = getPlayer();
      player.stop();
      void player.play();
    }
  },

  presets: PRESET_SOUND_SETS,

  loadPreset: (id) => {
    const target = PRESET_SOUND_SETS.find((p) => p.id === id);
    if (!target) return;

    getPlayer().stop();
    set({
      soundSet: target,
      selectedEventIndex: 0,
      validationError: null,
      isPlaying: false,
    });
    syncPlayer(get());
  },
}));
