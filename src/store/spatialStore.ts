import { create } from 'zustand';
import type { CardiacAudioPlayer } from '../audio';
import { locationsRecord, spatialConfig as defaultSpatialConfig } from '../data';
import {
  SpatialConfigSchema,
  type LocationId,
  type SpatialAcoustics,
  type SpatialConfig,
  type SpatialLandmark,
} from '../engine/schema';
import {
  calculateSpatialAuscultation,
  type SpatialAuscultationResult,
  type Vector3Tuple,
} from '../engine/spatial';

export type {
  LocationId,
  SpatialAcoustics,
  SpatialConfig,
  SpatialLandmark,
  SpatialAuscultationResult,
  Vector3Tuple,
};

export interface SpatialState {
  config: SpatialConfig;
  stethoscopePosition: Vector3Tuple;
  spatialResult: SpatialAuscultationResult;
  selectedLandmarkId: LocationId | null;
  validationError: string | null;

  setAcousticParam: <K extends keyof SpatialAcoustics>(key: K, value: SpatialAcoustics[K]) => void;
  setStethoscopePosition: (pos: Vector3Tuple) => void;
  selectAuditionValve: (id: LocationId) => void;
  resetToDefaults: () => void;
  exportJson: () => string;
  importJson: (jsonString: string) => boolean;
}

let activePlayer: CardiacAudioPlayer | null = null;

export function setSpatialPlayerInstance(player: CardiacAudioPlayer | null): void {
  activePlayer = player;
}

function syncPlayer(result: SpatialAuscultationResult): void {
  if (!activePlayer) return;
  activePlayer.setLocation(result.effectiveLocation);
  activePlayer.setSpatialParameters({
    gain: result.spatialGain,
    lowpassHz: result.tissueLowpassHz,
    pan: result.stereoPan,
  });
}

const initialPos: Vector3Tuple = defaultSpatialConfig.landmarks[0]?.position ?? [0, 1.4, 0.25];
const initialResult = calculateSpatialAuscultation(
  initialPos,
  locationsRecord,
  defaultSpatialConfig,
);

export const useSpatialStore = create<SpatialState>((set, get) => {
  const applyState = (
    config: SpatialConfig,
    pos: Vector3Tuple,
    selectedLandmark: LocationId | null,
  ) => {
    const spatialResult = calculateSpatialAuscultation(pos, locationsRecord, config);
    syncPlayer(spatialResult);
    set({
      config,
      stethoscopePosition: pos,
      spatialResult,
      selectedLandmarkId: selectedLandmark,
      validationError: null,
    });
  };

  return {
    config: defaultSpatialConfig,
    stethoscopePosition: initialPos,
    spatialResult: initialResult,
    selectedLandmarkId: initialResult.nearestValveId,
    validationError: null,

    setAcousticParam: (key, value) => {
      const { config, stethoscopePosition, selectedLandmarkId } = get();
      applyState(
        { ...config, acoustics: { ...config.acoustics, [key]: value } },
        stethoscopePosition,
        selectedLandmarkId,
      );
    },

    setStethoscopePosition: (pos) => {
      const { config } = get();
      const result = calculateSpatialAuscultation(pos, locationsRecord, config);
      syncPlayer(result);
      set({
        stethoscopePosition: pos,
        spatialResult: result,
        selectedLandmarkId: result.nearestValveId,
      });
    },

    selectAuditionValve: (id) => {
      const { config } = get();
      const landmark = config.landmarks.find((lm) => lm.id === id);
      if (landmark) applyState(config, landmark.position, id);
    },

    resetToDefaults: () => {
      applyState(
        defaultSpatialConfig,
        initialPos,
        defaultSpatialConfig.landmarks[0]?.id ?? 'aortic',
      );
    },

    exportJson: () => JSON.stringify(get().config, null, 2),

    importJson: (jsonString) => {
      try {
        const parsed: unknown = JSON.parse(jsonString);
        const result = SpatialConfigSchema.safeParse(parsed);
        if (!result.success) {
          const issue = result.error.issues[0];
          const path = issue?.path.join('.') ?? '';
          const msg = issue?.message ?? 'Invalid Spatial Schema';
          set({ validationError: path ? `${path}: ${msg}` : msg });
          return false;
        }
        const { stethoscopePosition, selectedLandmarkId } = get();
        applyState(result.data, stethoscopePosition, selectedLandmarkId);
        return true;
      } catch (err) {
        set({ validationError: err instanceof Error ? err.message : 'Malformed JSON syntax' });
        return false;
      }
    },
  };
});
