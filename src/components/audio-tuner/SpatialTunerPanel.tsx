import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { downloadTextFile } from '@/lib/downloadFile';
import { useSpatialStore, type LocationId } from '../../store';

const VALVE_LABELS: Record<LocationId, { name: string; landmark: string }> = {
  aortic: { name: 'Aortic', landmark: '2nd ICS RSB' },
  pulmonic: { name: 'Pulmonic', landmark: '2nd ICS LSB' },
  tricuspid: { name: 'Tricuspid', landmark: '4th-5th ICS LSB' },
  mitral: { name: 'Mitral / Apex', landmark: '5th ICS MCL' },
};

interface SliderDef {
  key:
    | 'sigma'
    | 'falloffHalfDist'
    | 'maxFilterHz'
    | 'minFilterHz'
    | 'filterRollOffDist'
    | 'stereoPanScale';
  label: string;
  badge: (val: number) => string;
  description: string;
  min: number;
  max: number;
  step: number;
  testId: string;
  presets: readonly { label: string; value: number }[];
}

const ACOUSTIC_SLIDERS: readonly SliderDef[] = [
  {
    key: 'sigma',
    label: 'Radiation Sigma (Spread)',
    badge: (v) => `${v.toFixed(2)} units`,
    description: 'Gaussian radiation radius around valve landmarks.',
    min: 0.04,
    max: 0.6,
    step: 0.01,
    testId: 'slider-sigma',
    presets: [
      { label: '0.12', value: 0.12 },
      { label: '0.16 (Default)', value: 0.16 },
      { label: '0.28', value: 0.28 },
    ],
  },
  {
    key: 'falloffHalfDist',
    label: 'Falloff Half Distance',
    badge: (v) => `${v.toFixed(2)}m`,
    description: 'Distance where auscultation volume attenuates by 50%.',
    min: 0.1,
    max: 1.0,
    step: 0.05,
    testId: 'slider-falloff',
    presets: [
      { label: '0.20m', value: 0.2 },
      { label: '0.35m (Default)', value: 0.35 },
      { label: '0.55m', value: 0.55 },
    ],
  },
  {
    key: 'maxFilterHz',
    label: 'Max Lowpass Frequency (Clear)',
    badge: (v) => `${String(Math.round(v))} Hz`,
    description: 'Frequency cutoff directly over valve center.',
    min: 1500,
    max: 8000,
    step: 100,
    testId: 'slider-maxfilter',
    presets: [
      { label: '2,800 Hz', value: 2800 },
      { label: '3,800 Hz (Default)', value: 3800 },
      { label: '5,000 Hz', value: 5000 },
    ],
  },
  {
    key: 'minFilterHz',
    label: 'Min Lowpass Frequency (Duffled)',
    badge: (v) => `${String(Math.round(v))} Hz`,
    description: 'Acoustic absorption cutoff far from valve sites.',
    min: 100,
    max: 1000,
    step: 20,
    testId: 'slider-minfilter',
    presets: [
      { label: '200 Hz', value: 200 },
      { label: '320 Hz (Default)', value: 320 },
      { label: '500 Hz', value: 500 },
    ],
  },
  {
    key: 'filterRollOffDist',
    label: 'Tissue Filter Roll-Off Distance',
    badge: (v) => `${v.toFixed(2)}m`,
    description: 'Rate of high-frequency absorption across chest tissue.',
    min: 0.1,
    max: 0.8,
    step: 0.05,
    testId: 'slider-rolloff',
    presets: [
      { label: '0.20m', value: 0.2 },
      { label: '0.30m (Default)', value: 0.3 },
      { label: '0.45m', value: 0.45 },
    ],
  },
  {
    key: 'stereoPanScale',
    label: 'Stereo Panning Intensity',
    badge: (v) => `${String(Math.round(v * 100))}%`,
    description: 'Subtle left/right panning based on horizontal placement.',
    min: 0.0,
    max: 1.5,
    step: 0.05,
    testId: 'slider-pan',
    presets: [
      { label: 'Disabled', value: 0 },
      { label: '80% (Default)', value: 0.8 },
      { label: '120%', value: 1.2 },
    ],
  },
];

export function SpatialTunerPanel() {
  const config = useSpatialStore((s) => s.config);
  const spatialResult = useSpatialStore((s) => s.spatialResult);
  const selectedLandmarkId = useSpatialStore((s) => s.selectedLandmarkId);
  const validationError = useSpatialStore((s) => s.validationError);

  const setAcousticParam = useSpatialStore((s) => s.setAcousticParam);
  const selectAuditionValve = useSpatialStore((s) => s.selectAuditionValve);
  const resetToDefaults = useSpatialStore((s) => s.resetToDefaults);
  const exportJson = useSpatialStore((s) => s.exportJson);
  const importJson = useSpatialStore((s) => s.importJson);

  const [copied, setCopied] = useState(false);
  const [showImportArea, setShowImportArea] = useState(false);
  const [importText, setImportText] = useState('');

  const handleCopy = () => {
    void navigator.clipboard.writeText(exportJson());
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  const handleImport = () => {
    if (importJson(importText)) {
      setShowImportArea(false);
      setImportText('');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Valve Landmark Audition */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold text-card-foreground">Valve Landmark Audition</h2>
          </CardTitle>
          <CardDescription>
            Quickly audition standard clinical auscultation landmarks and observe real-time spatial
            physics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(VALVE_LABELS) as LocationId[]).map((id) => {
              const { name, landmark } = VALVE_LABELS[id];
              const isSelected = selectedLandmarkId === id;
              return (
                <Button
                  key={id}
                  variant={isSelected ? 'default' : 'outline'}
                  className="flex h-auto flex-col items-start gap-1 p-3 text-left"
                  onClick={() => {
                    selectAuditionValve(id);
                  }}
                  data-testid={`audition-valve-${id}`}
                >
                  <span className="font-semibold text-sm">{name}</span>
                  <span className="text-xs text-muted-foreground">{landmark}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 2. Acoustic Propagation Controls */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h3 className="text-base font-semibold text-card-foreground">
                Acoustic Propagation Parameters
              </h3>
            </CardTitle>
            <CardDescription>
              Configure chest wall absorption, attenuation curves, and Gaussian spatial radiation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {ACOUSTIC_SLIDERS.map((slider) => {
              const val = config.acoustics[slider.key];
              return (
                <div
                  key={slider.key}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3.5 bg-muted/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {slider.label}:
                    </span>
                    <Badge variant="default">{slider.badge(val)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{slider.description}</p>
                  <Slider
                    value={[val]}
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    onValueChange={(vals) => {
                      const v = vals[0];
                      if (v !== undefined) setAcousticParam(slider.key, v);
                    }}
                    className="py-1"
                    data-testid={slider.testId}
                  />
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground mr-1">Presets:</span>
                    {slider.presets.map((preset) => (
                      <Button
                        key={preset.value}
                        variant={val === preset.value ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          setAcousticParam(slider.key, preset.value);
                        }}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 3. Live Auscultation Telemetry & Schema Manager */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <h3 className="text-base font-semibold text-card-foreground">
                  Live Auscultation Telemetry
                </h3>
              </CardTitle>
              <CardDescription>
                Real-time acoustic properties computed from current stethoscope position.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-3 bg-muted/20">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Nearest Valve:
                  </span>
                  <div className="text-sm font-bold capitalize mt-0.5">
                    {spatialResult.nearestValveId}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Distance: {spatialResult.nearestValveDistance} units
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3 bg-muted/20">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Spatial Gain &amp; Pan:
                  </span>
                  <div className="text-sm font-bold mt-0.5">
                    {Math.round(spatialResult.spatialGain * 100)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Pan:{' '}
                    {spatialResult.stereoPan > 0
                      ? `+${String(spatialResult.stereoPan)} (L)`
                      : `${String(spatialResult.stereoPan)} (R)`}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tissue Absorption Cutoff:
                </span>
                <div className="text-sm font-mono font-bold mt-1 text-primary">
                  {spatialResult.tissueLowpassHz.toLocaleString()} Hz
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Proximity Weight Distribution:
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {(Object.keys(VALVE_LABELS) as LocationId[]).map((id) => (
                    <div key={id} className="rounded border border-border p-2 bg-muted/30">
                      <span className="capitalize text-muted-foreground">{id}: </span>
                      <span className="font-mono font-semibold">
                        {Math.round(spatialResult.valveWeights[id] * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h3 className="text-base font-semibold text-card-foreground">
                  Spatial Schema &amp; Configuration
                </h3>
              </CardTitle>
              <CardDescription>
                Export and import schema configurations for curriculum distribution.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {validationError && (
                <div
                  className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
                  data-testid="spatial-validation-error"
                >
                  <strong>Schema Error:</strong> {validationError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  data-testid="copy-spatial-schema-btn"
                >
                  {copied ? 'Copied!' : 'Copy Spatial Schema'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    downloadTextFile('spatial.json', exportJson());
                  }}
                  data-testid="download-spatial-json-btn"
                >
                  Download spatial.json
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowImportArea(!showImportArea);
                  }}
                  data-testid="toggle-import-spatial-btn"
                >
                  {showImportArea ? 'Hide Import' : 'Import JSON'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground ml-auto"
                  onClick={resetToDefaults}
                  data-testid="reset-spatial-defaults-btn"
                >
                  Reset Defaults
                </Button>
              </div>

              {showImportArea && (
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <textarea
                    className="w-full h-32 rounded-md border border-input bg-background p-2 text-xs font-mono"
                    placeholder="Paste valid SpatialConfig JSON here..."
                    value={importText}
                    onChange={(e) => {
                      setImportText(e.target.value);
                    }}
                    data-testid="import-spatial-textarea"
                  />
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={!importText.trim()}
                    data-testid="apply-import-spatial-btn"
                  >
                    Validate &amp; Apply Spatial Schema
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active Schema JSON:
                </span>
                <pre className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] font-mono text-muted-foreground">
                  {exportJson()}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
