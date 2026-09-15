import { create } from 'zustand';
import { AudioPreviewPlayer, type TestSignalType } from '../audio';
import {
  SoundSetSchema,
  type SoundEvent,
  type SoundSet,
  type Filter,
  type Component,
  type MurmurShape,
} from '../engine/schema';

export type { SoundEvent, SoundSet, Filter, Component, MurmurShape };

export type SignalSource = TestSignalType | 'custom';

export interface TunerState {
  soundSet: SoundSet;
  selectedEventIndex: number;
  isPlaying: boolean;
  loop: boolean;
  signalSource: SignalSource;
  customFileName: string | null;
  validationError: string | null;

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
  setSignalSource: (source: SignalSource) => void;

  loadCustomAudio: (name: string, arrayBuffer: ArrayBuffer) => Promise<void>;
  play: () => void;
  stop: () => void;
  togglePlay: () => void;

  exportJson: () => string;
  importJson: (jsonString: string) => boolean;
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

let previewPlayer: AudioPreviewPlayer | null = null;

function getPlayer(): AudioPreviewPlayer {
  previewPlayer ??= new AudioPreviewPlayer();
  return previewPlayer;
}

// For headless unit testing
export function setPreviewPlayerInstance(player: AudioPreviewPlayer | null): void {
  previewPlayer = player;
}

export const useTunerStore = create<TunerState>((set, get) => ({
  soundSet: defaultSoundSet,
  selectedEventIndex: 0,
  isPlaying: false,
  loop: false,
  signalSource: 'heart-beat',
  customFileName: null,
  validationError: null,

  selectEvent: (index) => {
    const { soundSet } = get();
    if (index >= 0 && index < soundSet.events.length) {
      set({ selectedEventIndex: index });
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

    set({ soundSet: updatedSoundSet, validationError: null });

    // Sync live audio player if current event is playing
    if (index === get().selectedEventIndex) {
      const player = getPlayer();
      player.setGain(updated.gain);
      if (updated.kind === 'transient') {
        player.setPlaybackRate(updated.playbackRate);
      }
      player.setHighpass(updated.filter?.highpassHz);
      player.setLowpass(updated.filter?.lowpassHz);
    }
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
    set({
      soundSet: { ...soundSet, events: nextEvents },
      selectedEventIndex: nextEvents.length - 1,
      validationError: null,
    });
  },

  removeEvent: (index) => {
    const { soundSet, selectedEventIndex } = get();
    if (soundSet.events.length <= 1) {
      set({ validationError: 'A sound set must contain at least one event.' });
      return;
    }

    const nextEvents = soundSet.events.filter((_, i) => i !== index);
    const nextIndex = Math.min(selectedEventIndex, nextEvents.length - 1);

    set({
      soundSet: { ...soundSet, events: nextEvents },
      selectedEventIndex: Math.max(0, nextIndex),
      validationError: null,
    });
  },

  updateSoundSetMetadata: (label, id, description) => {
    const { soundSet } = get();
    const cleanId = id ? id.toLowerCase().replace(/[^a-z0-9-]/g, '-') : soundSet.id;

    set({
      soundSet: {
        ...soundSet,
        id: cleanId,
        label,
        ...(description !== undefined ? { description } : {}),
      },
      validationError: null,
    });
  },

  setFilter: (filter) => {
    const { soundSet, selectedEventIndex, updateEvent } = get();
    const current = soundSet.events[selectedEventIndex];
    if (!current) return;

    const updated = {
      ...current,
      filter: {
        ...(filter.highpassHz !== undefined ? { highpassHz: filter.highpassHz } : {}),
        ...(filter.lowpassHz !== undefined ? { lowpassHz: filter.lowpassHz } : {}),
      },
    } as SoundEvent;

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

  setSignalSource: (source) => {
    set({ signalSource: source });
    const player = getPlayer();
    if (source !== 'custom') {
      player.generateSyntheticBuffer(source);
      if (get().isPlaying) {
        get().play();
      }
    }
  },

  loadCustomAudio: async (name, arrayBuffer) => {
    const player = getPlayer();
    await player.loadAudioData(arrayBuffer);
    set({
      signalSource: 'custom',
      customFileName: name,
    });
    if (get().isPlaying) {
      get().play();
    }
  },

  play: () => {
    const { soundSet, selectedEventIndex, loop, signalSource } = get();
    const current = soundSet.events[selectedEventIndex];
    const player = getPlayer();

    if (signalSource !== 'custom') {
      player.generateSyntheticBuffer(signalSource);
    }

    const playbackRate = current?.kind === 'transient' ? current.playbackRate : 1;
    const gain = current ? current.gain : 1;
    const highpassHz = current?.filter?.highpassHz;
    const lowpassHz = current?.filter?.lowpassHz;

    player.play({
      gain,
      playbackRate,
      loop,
      ...(highpassHz !== undefined ? { highpassHz } : {}),
      ...(lowpassHz !== undefined ? { lowpassHz } : {}),
    });

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
        const errorMsg = validated.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        set({ validationError: errorMsg });
        return false;
      }

      set({
        soundSet: validated.data,
        selectedEventIndex: 0,
        validationError: null,
      });

      // Stop previous playback and sync parameters
      getPlayer().stop();
      set({ isPlaying: false });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JSON formatting';
      set({ validationError: message });
      return false;
    }
  },
}));
