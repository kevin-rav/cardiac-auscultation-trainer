import { AudioSourcePicker } from './AudioSourcePicker';
import { FilterControls } from './FilterControls';
import { ParameterControls } from './ParameterControls';
import { JsonExportPanel } from './JsonExportPanel';

export function AudioTuner() {
  return (
    <main className="tuner-container">
      <header className="tuner-header">
        <h1 className="tuner-main-title">Audio Filter & Sound Tuner</h1>
        <p className="tuner-tagline">
          Adjust frequencies, gains, playback rates, and murmur envelopes with live Web Audio
          preview and export compliant Sound Set schemas.
        </p>
      </header>

      <div className="tuner-grid">
        <div className="tuner-column">
          <AudioSourcePicker />
          <FilterControls />
        </div>

        <div className="tuner-column">
          <ParameterControls />
          <JsonExportPanel />
        </div>
      </div>
    </main>
  );
}
