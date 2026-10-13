import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioTuner } from './AudioTuner';
import { useTunerStore, setPreviewPlayerInstance, setCardiacPlayerInstance } from '../../store';
import type { AudioPreviewPlayer, CardiacAudioPlayer } from '../../audio';

const mockPlayer = {
  play: vi.fn(),
  stop: vi.fn(),
  setGain: vi.fn(),
  setPlaybackRate: vi.fn(),
  setHighpass: vi.fn(),
  setLowpass: vi.fn(),
  setLoop: vi.fn(),
  setBpm: vi.fn(),
  loadSampleUrl: vi.fn().mockResolvedValue({}),
  loadAudioData: vi.fn().mockResolvedValue({}),
  restoreCustomBuffer: vi.fn(),
  setBuffer: vi.fn(),
} as unknown as AudioPreviewPlayer;

const initialState = useTunerStore.getState();

const mockCardiacPlayer = {
  play: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  setSoundSet: vi.fn(),
  setBpm: vi.fn(),
  setVolume: vi.fn(),
  getSampleLoader: () => ({ preloadManifest: vi.fn().mockResolvedValue({}) }),
} as unknown as CardiacAudioPlayer;

describe('AudioTuner UI Component', () => {
  beforeEach(() => {
    useTunerStore.setState(initialState, true);
    setPreviewPlayerInstance(mockPlayer);
    setCardiacPlayerInstance(mockCardiacPlayer);
    useTunerStore.setState({ isPlaying: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders title and main panels', () => {
    render(<AudioTuner />);

    expect(screen.getByRole('heading', { name: /Audio Filter & Sound Tuner/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /Audio Source & Playback/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /Filter Equalization/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /Sound Set Events/i })).toBeDefined();
    expect(
      screen.getByRole('heading', {
        name: /Sound Set Metadata & JSON Schema/i,
      }),
    ).toBeDefined();
  });

  it('toggles audio playback on button click', () => {
    render(<AudioTuner />);
    const playBtn = screen.getByTestId('play-btn');

    expect(playBtn.textContent).toMatch(/Play/i);
    fireEvent.click(playBtn);
    expect(playBtn.textContent).toMatch(/Stop/i);

    fireEvent.click(playBtn);
    expect(playBtn.textContent).toMatch(/Play/i);
  });

  it('disables play preview button when custom source is selected without uploaded file', () => {
    render(<AudioTuner />);
    const playBtn = screen.getByTestId('play-btn');
    expect((playBtn as HTMLButtonElement).disabled).toBe(false);

    // Switch to isolated mode and select custom audio source
    fireEvent.click(screen.getByTestId('mode-isolated'));
    const sourceSelect = screen.getByLabelText(/Audio Sample Source/i);
    fireEvent.change(sourceSelect, { target: { value: 'custom' } });

    expect((playBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('adds and removes events via UI', () => {
    render(<AudioTuner />);
    const addMurmurBtn = screen.getByRole('button', { name: /\+ Add Murmur/i });
    fireEvent.click(addMurmurBtn);

    expect(useTunerStore.getState().soundSet.events.length).toBe(3);

    const deleteBtn = screen.getByRole('button', { name: /Delete Event/i });
    fireEvent.click(deleteBtn);

    expect(useTunerStore.getState().soundSet.events.length).toBe(2);
  });

  it('disables filter presets that would cross the opposing cutoff', () => {
    // S1 default: highpass 80 Hz, lowpass 1200 Hz
    render(<AudioTuner />);

    // 500 Hz exists in both HP and LP presets (HP is first, LP is second)
    const buttons500 = screen.getAllByRole('button', { name: '500 Hz' });
    const hp500Btn = buttons500[0] as HTMLButtonElement;
    const lp500Btn = buttons500[1] as HTMLButtonElement;

    fireEvent.click(lp500Btn);
    expect(useTunerStore.getState().soundSet.events[0]?.filter?.lowpassHz).toBe(500);

    // HP preset 500 Hz should now be disabled since lowpass is 500 Hz (highpass must be < lowpass)
    expect(hp500Btn.disabled).toBe(true);
  });

  it('imports valid and invalid JSON through the import panel', () => {
    render(<AudioTuner />);
    const toggleImportBtn = screen.getByTestId('toggle-import-btn');
    fireEvent.click(toggleImportBtn);

    const textarea = screen.getByTestId('import-textarea');
    const applyBtn = screen.getByTestId('apply-import-btn');

    // Test invalid JSON
    fireEvent.change(textarea, { target: { value: '{"id": "broken"}' } });
    fireEvent.click(applyBtn);
    expect(screen.getByTestId('validation-error')).toBeDefined();

    // Test valid JSON
    const validJson = JSON.stringify({
      id: 'custom-sound-set',
      label: 'Custom Heart Sound',
      events: [
        {
          kind: 'transient',
          component: 'S1',
          sample: 'custom-s1',
          at: { anchor: 'S1' },
          gain: 1.2,
          playbackRate: 1,
        },
      ],
    });

    fireEvent.change(textarea, { target: { value: validJson } });
    fireEvent.click(applyBtn);
    expect(useTunerStore.getState().soundSet.id).toBe('custom-sound-set');
  });

  it('adjusts BPM via input and preset buttons', () => {
    render(<AudioTuner />);

    expect(screen.getByText(/Heart Rate \/ BPM:/i)).toBeDefined();
    expect(screen.getByText(/72 BPM/i)).toBeDefined();

    const bpmInput = screen.getByTestId('bpm-input');
    fireEvent.change(bpmInput, { target: { value: '88' } });
    expect(useTunerStore.getState().bpm).toBe(88);
    expect(screen.getByText(/88 BPM/i)).toBeDefined();

    const preset120 = screen.getByRole('button', { name: '120' });
    fireEvent.click(preset120);
    expect(useTunerStore.getState().bpm).toBe(120);
    expect(screen.getByText(/120 BPM/i)).toBeDefined();
  });
});
