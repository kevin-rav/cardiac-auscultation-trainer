import { AudioSourcePicker } from './AudioSourcePicker';
import { FilterControls } from './FilterControls';
import { ParameterControls } from './ParameterControls';
import { JsonExportPanel } from './JsonExportPanel';

export function AudioTuner() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Audio Filter &amp; Sound Tuner
        </h1>
        <p className="text-sm text-muted-foreground">
          Adjust frequencies, gains, playback rates, and murmur envelopes with live Web Audio
          preview and export compliant Sound Set schemas.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <AudioSourcePicker />
          <FilterControls />
        </div>

        <div className="flex flex-col gap-6">
          <ParameterControls />
          <JsonExportPanel />
        </div>
      </div>
    </main>
  );
}
