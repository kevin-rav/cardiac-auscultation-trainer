import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioTuner } from './AudioTuner';
import { useTunerStore, setPreviewPlayerInstance } from '../../store';
import type { AudioPreviewPlayer } from '../../audio';

const mockPlayer = {
  play: vi.fn(),
  stop: vi.fn(),
  setGain: vi.fn(),
  setPlaybackRate: vi.fn(),
  setHighpass: vi.fn(),
  setLowpass: vi.fn(),
  setLoop: vi.fn(),
  generateSyntheticBuffer: vi.fn(),
  loadAudioData: vi.fn().mockResolvedValue({}),
} as unknown as AudioPreviewPlayer;

describe('AudioTuner UI Component', () => {
  beforeEach(() => {
    setPreviewPlayerInstance(mockPlayer);
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

    expect(playBtn.textContent).toMatch(/Play Preview/i);
    fireEvent.click(playBtn);
    expect(playBtn.textContent).toMatch(/Stop/i);

    fireEvent.click(playBtn);
    expect(playBtn.textContent).toMatch(/Play Preview/i);
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
});
