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

  // Actions
  setAcousticParam: <K extends keyof SpatialAcoustics>(key: K, value: SpatialAcoustics[K]) => void;
  setAcoustics: (acoustics: Partial<SpatialAcoustics>) => void;
  setStethoscopePosition: (pos: Vector3Tuple) => void;
  setLandmarkPosition: (id: LocationId, pos: Vector3Tuple) => void;
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

const initialPosition: Vector3Tuple = defaultSpatialConfig.landmarks[0]?.position ?? [
  -0.08, 1.442, 0.264,
];
const initialResult = calculateSpatialAuscultation(
  initialPosition,
  locationsRecord,
  defaultSpatialConfig,
);

export const useSpatialStore = create<SpatialState>((set, get) => ({
  config: defaultSpatialConfig,
  stethoscopePosition: initialPosition,
  spatialResult: initialResult,
  selectedLandmarkId: defaultSpatialConfig.landmarks[0]?.id ?? 'aortic',
  validationError: null,

  setAcousticParam: (key, value) => {
    const current = get();
    const updatedAcoustics: SpatialAcoustics = {
      ...current.config.acoustics,
      [key]: value,
    };
    const updatedConfig: SpatialConfig = {
      ...current.config,
      acoustics: updatedAcoustics,
    };
    const spatialResult = calculateSpatialAuscultation(
      current.stethoscopePosition,
      locationsRecord,
      updatedConfig,
    );
    syncPlayer(spatialResult);
    set({
      config: updatedConfig,
      spatialResult,
      validationError: null,
    });
  },

  setAcoustics: (acoustics) => {
    const current = get();
    const updatedAcoustics: SpatialAcoustics = {
      ...current.config.acoustics,
      ...acoustics,
    };
    const updatedConfig: SpatialConfig = {
      ...current.config,
      acoustics: updatedAcoustics,
    };
    const spatialResult = calculateSpatialAuscultation(
      current.stethoscopePosition,
      locationsRecord,
      updatedConfig,
    );
    syncPlayer(spatialResult);
    set({
      config: updatedConfig,
      spatialResult,
      validationError: null,
    });
  },

  setStethoscopePosition: (pos) => {
    const current = get();
    const spatialResult = calculateSpatialAuscultation(pos, locationsRecord, current.config);
    syncPlayer(spatialResult);
    set({
      stethoscopePosition: pos,
      spatialResult,
      selectedLandmarkId: spatialResult.nearestValveId,
    });
  },

  setLandmarkPosition: (id, pos) => {
    const current = get();
    const updatedLandmarks: SpatialLandmark[] = current.config.landmarks.map((lm) =>
      lm.id === id ? { ...lm, position: pos } : lm,
    );
    const updatedConfig: SpatialConfig = {
      ...current.config,
      landmarks: updatedLandmarks,
    };
    const spatialResult = calculateSpatialAuscultation(
      current.stethoscopePosition,
      locationsRecord,
      updatedConfig,
    );
    syncPlayer(spatialResult);
    set({
      config: updatedConfig,
      spatialResult,
    });
  },

  selectAuditionValve: (id) => {
    const current = get();
    const landmark = current.config.landmarks.find((lm) => lm.id === id);
    if (!landmark) return;
    const spatialResult = calculateSpatialAuscultation(
      landmark.position,
      locationsRecord,
      current.config,
    );
    syncPlayer(spatialResult);
    set({
      stethoscopePosition: landmark.position,
      spatialResult,
      selectedLandmarkId: id,
    });
  },

  resetToDefaults: () => {
    const defaultPos: Vector3Tuple = defaultSpatialConfig.landmarks[0]?.position ?? [
      -0.08, 1.442, 0.264,
    ];
    const spatialResult = calculateSpatialAuscultation(
      defaultPos,
      locationsRecord,
      defaultSpatialConfig,
    );
    syncPlayer(spatialResult);
    set({
      config: defaultSpatialConfig,
      stethoscopePosition: defaultPos,
      spatialResult,
      selectedLandmarkId: 'aortic',
      validationError: null,
    });
  },

  exportJson: () => {
    return JSON.stringify(get().config, null, 2);
  },

  importJson: (jsonString) => {
    try {
      const parsed: unknown = JSON.parse(jsonString);
      const validation = SpatialConfigSchema.safeParse(parsed);
      if (!validation.success) {
        const errorMsg = validation.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(', ');
        set({ validationError: errorMsg });
        return false;
      }

      const validConfig = validation.data;
      const current = get();
      const spatialResult = calculateSpatialAuscultation(
        current.stethoscopePosition,
        locationsRecord,
        validConfig,
      );
      syncPlayer(spatialResult);
      set({
        config: validConfig,
        spatialResult,
        validationError: null,
      });
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid JSON format';
      set({ validationError: errorMsg });
      return false;
    }
  },
}));
