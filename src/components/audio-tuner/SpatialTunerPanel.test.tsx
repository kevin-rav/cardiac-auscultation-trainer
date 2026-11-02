import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpatialTunerPanel } from './SpatialTunerPanel';
import { useSpatialStore } from '../../store';

describe('SpatialTunerPanel UI Component', () => {
  beforeEach(() => {
    useSpatialStore.getState().resetToDefaults();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders headings, valve audition buttons, telemetry, and schema cards', () => {
    render(<SpatialTunerPanel />);

    expect(screen.getByRole('heading', { name: /Valve Landmark Audition/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /Acoustic Propagation/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /Live Auscultation Telemetry/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /Spatial Schema & Configuration/i })).toBeDefined();

    expect(screen.getByTestId('audition-valve-aortic')).toBeDefined();
    expect(screen.getByTestId('audition-valve-pulmonic')).toBeDefined();
    expect(screen.getByTestId('audition-valve-tricuspid')).toBeDefined();
    expect(screen.getByTestId('audition-valve-mitral')).toBeDefined();
  });

  it('switches active valve when audition button is clicked', () => {
    render(<SpatialTunerPanel />);
    const mitralBtn = screen.getByTestId('audition-valve-mitral');

    fireEvent.click(mitralBtn);
    expect(useSpatialStore.getState().selectedLandmarkId).toBe('mitral');
    expect(useSpatialStore.getState().spatialResult.nearestValveId).toBe('mitral');
  });

  it('adjusts sigma and falloff using preset buttons', () => {
    render(<SpatialTunerPanel />);

    // Click 0.28 preset for sigma
    const sigmaPreset028 = screen.getByRole('button', { name: '0.28' });
    fireEvent.click(sigmaPreset028);
    expect(useSpatialStore.getState().config.acoustics.sigma).toBe(0.28);

    // Click 0.55m preset for falloff
    const falloffPreset055 = screen.getByRole('button', { name: '0.55m' });
    fireEvent.click(falloffPreset055);
    expect(useSpatialStore.getState().config.acoustics.falloffHalfDist).toBe(0.55);
  });

  it('imports valid and invalid spatial JSON via UI', () => {
    render(<SpatialTunerPanel />);
    const toggleImportBtn = screen.getByTestId('toggle-import-spatial-btn');
    fireEvent.click(toggleImportBtn);

    const textarea = screen.getByTestId('import-spatial-textarea');
    const applyBtn = screen.getByTestId('apply-import-spatial-btn');

    // Test invalid JSON
    fireEvent.change(textarea, { target: { value: '{"broken": true}' } });
    fireEvent.click(applyBtn);
    expect(screen.getByTestId('spatial-validation-error')).toBeDefined();

    // Test valid JSON
    const validConfig = {
      version: '1.0.0',
      description: 'Custom Test Config',
      acoustics: {
        sigma: 0.2,
        falloffHalfDist: 0.4,
        maxFilterHz: 4500,
        minFilterHz: 250,
        filterRollOffDist: 0.35,
        stereoPanScale: 0.7,
      },
      landmarks: useSpatialStore.getState().config.landmarks,
    };

    fireEvent.change(textarea, { target: { value: JSON.stringify(validConfig) } });
    fireEvent.click(applyBtn);

    expect(useSpatialStore.getState().config.acoustics.sigma).toBe(0.2);
    expect(useSpatialStore.getState().config.acoustics.maxFilterHz).toBe(4500);
    expect(screen.queryByTestId('spatial-validation-error')).toBeNull();
  });

  it('resets to defaults when clicking Reset Defaults button', () => {
    render(<SpatialTunerPanel />);
    useSpatialStore.getState().setAcousticParam('sigma', 0.45);
    expect(useSpatialStore.getState().config.acoustics.sigma).toBe(0.45);

    const resetBtn = screen.getByTestId('reset-spatial-defaults-btn');
    fireEvent.click(resetBtn);

    expect(useSpatialStore.getState().config.acoustics.sigma).toBe(0.16);
  });
});
