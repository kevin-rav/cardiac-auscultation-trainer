import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AudioSourcePicker } from './AudioSourcePicker';
import { FilterControls } from './FilterControls';
import { ParameterControls } from './ParameterControls';
import { JsonExportPanel } from './JsonExportPanel';
import { SpatialTunerPanel } from './SpatialTunerPanel';

export function AudioTuner() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Audio Filter &amp; Sound Tuner
        </h1>
        <p className="text-sm text-muted-foreground">
          Adjust frequencies, gains, playback rates, murmur envelopes, and 3D spatial acoustics with
          live Web Audio preview and export compliant schemas.
        </p>
      </header>

      <Tabs defaultValue="sound-set" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-lg">
          <TabsTrigger value="sound-set" data-testid="tab-sound-set">
            Sound Set &amp; Murmurs
          </TabsTrigger>
          <TabsTrigger value="spatial" data-testid="tab-spatial">
            Spatial Auscultation &amp; 3D Acoustics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sound-set" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="spatial">
          <SpatialTunerPanel />
        </TabsContent>
      </Tabs>
    </main>
  );
}
