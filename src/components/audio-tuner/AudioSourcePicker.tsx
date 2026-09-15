import type { ChangeEvent } from 'react';
import { useTunerStore } from '../../store';

export function AudioSourcePicker() {
  const signalSource = useTunerStore((s) => s.signalSource);
  const customFileName = useTunerStore((s) => s.customFileName);
  const isPlaying = useTunerStore((s) => s.isPlaying);
  const loop = useTunerStore((s) => s.loop);
  const setSignalSource = useTunerStore((s) => s.setSignalSource);
  const setLoop = useTunerStore((s) => s.setLoop);
  const togglePlay = useTunerStore((s) => s.togglePlay);
  const loadCustomAudio = useTunerStore((s) => s.loadCustomAudio);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        void loadCustomAudio(file.name, reader.result);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <section className="tuner-panel">
      <h3 className="panel-title">Audio Source & Playback</h3>

      <div className="source-selector">
        <label className="field-label">Signal Source:</label>
        <div className="radio-group">
          <label className="radio-option">
            <input
              type="radio"
              name="signalSource"
              value="heart-beat"
              checked={signalSource === 'heart-beat'}
              onChange={() => {
                setSignalSource('heart-beat');
              }}
            />
            Heart Sound Pulse (60Hz)
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="signalSource"
              value="click"
              checked={signalSource === 'click'}
              onChange={() => {
                setSignalSource('click');
              }}
            />
            Valve Click (1.2kHz)
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="signalSource"
              value="murmur"
              checked={signalSource === 'murmur'}
              onChange={() => {
                setSignalSource('murmur');
              }}
            />
            Turbulent Murmur Noise
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="signalSource"
              value="custom"
              checked={signalSource === 'custom'}
              onChange={() => {
                setSignalSource('custom');
              }}
            />
            Custom Audio File (.wav / .mp3)
          </label>
        </div>
      </div>

      {signalSource === 'custom' && (
        <div className="file-upload-box">
          <label htmlFor="audio-file-input" className="field-label">
            Upload Audio Sample:
          </label>
          <input
            id="audio-file-input"
            type="file"
            accept="audio/wav, audio/mpeg, audio/mp3, audio/ogg"
            onChange={handleFileUpload}
            className="file-input"
          />
          {customFileName && <p className="file-name-display">Loaded: {customFileName}</p>}
        </div>
      )}

      <div className="playback-controls">
        <button
          type="button"
          className={`btn ${isPlaying ? 'btn-danger' : 'btn-primary'}`}
          onClick={togglePlay}
          data-testid="play-btn"
        >
          {isPlaying ? '■ Stop' : '▶ Play Preview'}
        </button>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => {
              setLoop(e.target.checked);
            }}
          />
          Loop Playback
        </label>
      </div>
    </section>
  );
}
