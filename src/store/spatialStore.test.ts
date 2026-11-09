import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardiacAudioPlayer } from '../audio';
import { spatialConfig } from '../data';
import { setSpatialPlayerInstance, useSpatialStore } from './spatialStore';

const setLocationMock = vi.fn();
const setSpatialParametersMock = vi.fn();

const mockPlayer = {
  setLocation: setLocationMock,
  setSpatialParameters: setSpatialParametersMock,
} as unknown as CardiacAudioPlayer;

describe('SpatialStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSpatialPlayerInstance(mockPlayer);
    useSpatialStore.getState().resetToDefaults();
  });

  it('initializes with default spatial configuration and aortic landmark', () => {
    const state = useSpatialStore.getState();
    expect(state.config.acoustics.sigma).toBe(spatialConfig.acoustics.sigma);
    expect(state.config.landmarks.length).toBe(4);
    expect(state.selectedLandmarkId).toBe('aortic');
    expect(state.spatialResult.nearestValveId).toBe('aortic');
  });

  it('updates acoustic parameter and notifies player', () => {
    useSpatialStore.getState().setAcousticParam('sigma', 0.25);
    const state = useSpatialStore.getState();

    expect(state.config.acoustics.sigma).toBe(0.25);
    expect(setLocationMock).toHaveBeenCalled();
    expect(setSpatialParametersMock).toHaveBeenCalled();
    const lastCall = setSpatialParametersMock.mock.lastCall?.[0] as
      { gain: number; lowpassHz: number; pan: number } | undefined;
    expect(typeof lastCall?.gain).toBe('number');
    expect(typeof lastCall?.lowpassHz).toBe('number');
    expect(typeof lastCall?.pan).toBe('number');
  });

  it('updates stethoscope position and calculates live acoustics', () => {
    // Move to Mitral coordinates
    const mitralPos: [number, number, number] = [0.321, 1.023, 0.299];
    useSpatialStore.getState().setStethoscopePosition(mitralPos);

    const state = useSpatialStore.getState();
    expect(state.stethoscopePosition).toEqual(mitralPos);
    expect(state.selectedLandmarkId).toBe('mitral');
    expect(state.spatialResult.nearestValveId).toBe('mitral');
    expect(state.spatialResult.valveWeights.mitral).toBeGreaterThan(0.7);
  });

  it('auditions valve landmark directly', () => {
    useSpatialStore.getState().selectAuditionValve('pulmonic');
    const state = useSpatialStore.getState();

    expect(state.selectedLandmarkId).toBe('pulmonic');
    expect(state.spatialResult.nearestValveId).toBe('pulmonic');
  });

  it('exports configuration as valid JSON', () => {
    const exported = useSpatialStore.getState().exportJson();
    const parsed: unknown = JSON.parse(exported);
    expect(parsed).toHaveProperty('acoustics');
    expect(parsed).toHaveProperty('landmarks');
  });

  it('imports valid JSON and updates state', () => {
    const customConfig = {
      version: '1.0.0',
      description: 'Custom Instructor Setup',
      acoustics: {
        sigma: 0.12,
        falloffHalfDist: 0.4,
        maxFilterHz: 4000,
        minFilterHz: 400,
        filterRollOffDist: 0.35,
        stereoPanScale: 0.9,
      },
      landmarks: spatialConfig.landmarks,
    };

    const success = useSpatialStore.getState().importJson(JSON.stringify(customConfig));
    expect(success).toBe(true);
    expect(useSpatialStore.getState().config.acoustics.sigma).toBe(0.12);
    expect(useSpatialStore.getState().validationError).toBeNull();
  });

  it('rejects invalid JSON with validation error', () => {
    const invalidConfig = {
      version: '1.0.0',
      acoustics: {
        sigma: -5, // Invalid: min is 0.01
      },
    };

    const success = useSpatialStore.getState().importJson(JSON.stringify(invalidConfig));
    expect(success).toBe(false);
    expect(useSpatialStore.getState().validationError).toBeDefined();
    expect(useSpatialStore.getState().validationError).toContain('sigma');
  });

  it('resets to defaults cleanly', () => {
    useSpatialStore.getState().setAcousticParam('sigma', 0.5);
    expect(useSpatialStore.getState().config.acoustics.sigma).toBe(0.5);

    useSpatialStore.getState().resetToDefaults();
    expect(useSpatialStore.getState().config.acoustics.sigma).toBe(spatialConfig.acoustics.sigma);
  });
});
