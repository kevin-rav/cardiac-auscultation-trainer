import { create } from 'zustand';
import { AudioPreviewPlayer, CardiacAudioPlayer, type TestSignalType } from '../audio';
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
  | 'event-sample'
  | 's1-apex'
  | 's2-base'
  | 's3'
  | 's4'
  | 'click'
  | 'murmur-noise'
  | 'custom'
  | TestSignalType;

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

let previewPlayer: AudioPreviewPlayer | null = null;
let cardiacPlayer: CardiacAudioPlayer | null = null;

function getPlayer(): AudioPreviewPlayer {
  previewPlayer ??= new AudioPreviewPlayer();
  return previewPlayer;
}

function getCardiacPlayer(): CardiacAudioPlayer {
  if (!cardiacPlayer) {
    cardiacPlayer = new CardiacAudioPlayer(useTunerStore.getState().soundSet, undefined, manifest);
    void cardiacPlayer.getSampleLoader().preloadManifest(manifest);
  }
  return cardiacPlayer;
}

function syncPlayerEvent(player: AudioPreviewPlayer, event: SoundEvent): void {
  player.setGain(event.gain);
  player.setPlaybackRate(event.kind === 'transient' ? event.playbackRate : 1);
  player.setHighpass(event.filter?.highpassHz);
  player.setLowpass(event.filter?.lowpassHz);
}

// For headless unit testing
export function setPreviewPlayerInstance(player: AudioPreviewPlayer | null): void {
  previewPlayer = player;
}

export function setCardiacPlayerInstance(player: CardiacAudioPlayer | null): void {
  cardiacPlayer = player;
}

function syncActivePlayers(updatedSoundSet: SoundSet): void {
  if (cardiacPlayer) {
    cardiacPlayer.setSoundSet(updatedSoundSet);
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
    const { soundSet, signalSource, isPlaying, playbackMode } = get();
    if (index >= 0 && index < soundSet.events.length) {
      set({ selectedEventIndex: index });
      const target = soundSet.events[index];
      if (isPlaying && target && playbackMode === 'isolated') {
        syncPlayerEvent(getPlayer(), target);
      }
      if (signalSource === 'event-sample') {
        const nextEvent = soundSet.events[index];
        if (nextEvent) {
          void getPlayer()
            .loadSampleUrl(`/sounds/${nextEvent.sample}.wav`)
            .then((buffer) => {
              if (
                buffer &&
                get().isPlaying &&
                get().selectedEventIndex === index &&
                get().playbackMode === 'isolated'
              ) {
                get().play();
              }
            });
        }
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

    // Sync full cardiac cycle player immediately so next upcoming beat uses new settings
    syncActivePlayers(updatedSoundSet);

    // Sync live preview audio player if current event is playing in isolated preview mode
    if (index === get().selectedEventIndex) {
      syncPlayerEvent(getPlayer(), updated);
      if (get().playbackMode === 'isolated' && get().signalSource === 'event-sample') {
        void getPlayer().loadSampleUrl(`/sounds/${updated.sample}.wav`);
      }
    }
  },

  addEvent: (kind) => {
    const { soundSet, isPlaying } = get();
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

    syncActivePlayers(updatedSoundSet);
    if (isPlaying) {
      syncPlayerEvent(getPlayer(), newEvent);
    }
  },

  removeEvent: (index) => {
    const { soundSet, selectedEventIndex, isPlaying } = get();
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

    syncActivePlayers(updatedSoundSet);
    const active = nextEvents[resolvedIndex];
    if (isPlaying && active) {
      syncPlayerEvent(getPlayer(), active);
    }
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

    syncActivePlayers(updatedSoundSet);
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
    if (cardiacPlayer) {
      cardiacPlayer.setBpm(clamped);
    }
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
    const player = getPlayer();
    if (source !== 'custom') {
      if (
        source === 'click' ||
        source === 'heart-beat' ||
        source === 'murmur-noise' ||
        source === 'murmur'
      ) {
        player.generateSyntheticBuffer(source === 'murmur' ? 'murmur-noise' : source);
      }
      const { soundSet, selectedEventIndex } = get();
      const current = soundSet.events[selectedEventIndex];
      const sampleId = source === 'event-sample' ? (current?.sample ?? 's1-apex') : source;
      void player.loadSampleUrl(`/sounds/${sampleId}.wav`).then((buffer) => {
        if (
          buffer &&
          get().isPlaying &&
          get().signalSource === source &&
          get().playbackMode === 'isolated'
        ) {
          get().play();
        }
      });
      if (get().isPlaying && get().playbackMode === 'isolated') {
        get().play();
      }
    } else {
      if (typeof player.restoreCustomBuffer === 'function') {
        player.restoreCustomBuffer();
      } else if (typeof player.setBuffer === 'function') {
        player.setBuffer(null);
      }
      if (!get().customFileName) {
        if (get().isPlaying) {
          get().stop();
        }
      } else if (get().isPlaying) {
        get().play();
      }
    }
  },

  loadCustomAudio: async (name, arrayBuffer) => {
    const player = getPlayer();
    try {
      await player.loadAudioData(arrayBuffer);
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
    if (get().isPlaying) {
      get().play();
    }
  },

  play: () => {
    const { soundSet, selectedEventIndex, loop, bpm, signalSource, customFileName, playbackMode } =
      get();

    if (playbackMode === 'full-cycle') {
      getPlayer().stop();
      const cp = getCardiacPlayer();
      cp.setSoundSet(soundSet);
      cp.setBpm(bpm);
      void cp.play();
      set({ isPlaying: true });
      return;
    }

    if (cardiacPlayer) {
      cardiacPlayer.stop();
    }

    if (signalSource === 'custom' && !customFileName) {
      return;
    }

    const current = soundSet.events[selectedEventIndex];
    const player = getPlayer();

    if (
      signalSource === 'click' ||
      signalSource === 'heart-beat' ||
      signalSource === 'murmur-noise' ||
      signalSource === 'murmur'
    ) {
      player.generateSyntheticBuffer(signalSource === 'murmur' ? 'murmur-noise' : signalSource);
    } else if (signalSource === 'custom' && typeof player.restoreCustomBuffer === 'function') {
      player.restoreCustomBuffer();
    }

    const playbackRate = current?.kind === 'transient' ? current.playbackRate : 1;
    const gain = current ? current.gain : 1;
    const highpassHz = current?.filter?.highpassHz;
    const lowpassHz = current?.filter?.lowpassHz;

    const playOptions = {
      gain,
      playbackRate,
      loop,
      bpm,
      ...(highpassHz !== undefined ? { highpassHz } : {}),
      ...(lowpassHz !== undefined ? { lowpassHz } : {}),
      onEnded: () => {
        set({ isPlaying: false });
      },
    };

    set({ isPlaying: true });
    player.play(playOptions);

    if (signalSource !== 'custom' && signalSource !== 'click' && signalSource !== 'heart-beat') {
      const sampleId =
        signalSource === 'event-sample' ? (current?.sample ?? 's1-apex') : signalSource;
      void player.loadSampleUrl(`/sounds/${sampleId}.wav`).then((buffer) => {
        if (buffer && get().isPlaying && get().playbackMode === 'isolated') {
          player.play(playOptions);
        }
      });
    }
  },

  stop: () => {
    getPlayer().stop();
    if (cardiacPlayer) {
      cardiacPlayer.stop();
    }
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

      syncActivePlayers(validated.data);

      // Stop previous playback and sync parameters
      getPlayer().stop();
      if (cardiacPlayer) {
        cardiacPlayer.stop();
      }
      set({ isPlaying: false });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JSON formatting';
      set({ validationError: message });
      return false;
    }
  },

  applyChanges: () => {
    const { soundSet, isPlaying, playbackMode, bpm } = get();
    syncActivePlayers(soundSet);
    if (isPlaying) {
      if (playbackMode === 'full-cycle') {
        const cp = getCardiacPlayer();
        cp.stop();
        cp.setSoundSet(soundSet);
        cp.setBpm(bpm);
        void cp.play();
      } else {
        const p = getPlayer();
        p.stop();
        get().play();
      }
    }
  },

  presets: PRESET_SOUND_SETS,

  loadPreset: (id) => {
    const target = PRESET_SOUND_SETS.find((p) => p.id === id);
    if (!target) return;

    getPlayer().stop();
    if (cardiacPlayer) {
      cardiacPlayer.stop();
      cardiacPlayer.setSoundSet(target);
    }
    set({
      soundSet: target,
      selectedEventIndex: 0,
      validationError: null,
      isPlaying: false,
    });

    const firstEvent = target.events[0];
    if (firstEvent && get().signalSource === 'event-sample') {
      void getPlayer().loadSampleUrl(`/sounds/${firstEvent.sample}.wav`);
    }
  },
}));
