import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { useSpatialStore, type LocationId } from '../../store';

const VALVE_LABELS: Record<LocationId, { name: string; landmark: string }> = {
  aortic: { name: 'Aortic', landmark: '2nd ICS RSB' },
  pulmonic: { name: 'Pulmonic', landmark: '2nd ICS LSB' },
  tricuspid: { name: 'Tricuspid', landmark: '4th-5th ICS LSB' },
  mitral: { name: 'Mitral / Apex', landmark: '5th ICS MCL' },
};

interface AcousticSliderProps {
  label: string;
  badge: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  testId: string;
  presets?: readonly { label: string; value: number }[];
  onChange: (val: number) => void;
}

function AcousticSlider({
  label,
  badge,
  description,
  value,
  min,
  max,
  step,
  testId,
  presets,
  onChange,
}: AcousticSliderProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3.5 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}:
        </span>
        <Badge variant="default">{badge}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => {
          const val = vals[0];
          if (val !== undefined) onChange(val);
        }}
        className="py-1"
        data-testid={testId}
      />
      {presets && presets.length > 0 && (
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-[11px] text-muted-foreground mr-1">Presets:</span>
          {presets.map((preset) => (
            <Button
              key={preset.value}
              variant={value === preset.value ? 'default' : 'outline'}
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => {
                onChange(preset.value);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

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

  const acoustics = config.acoustics;

  const handleCopy = () => {
    void navigator.clipboard.writeText(exportJson()).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  };

  const handleDownload = () => {
    const json = exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'spatial.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const success = importJson(importText);
    if (success) {
      setShowImportArea(false);
      setImportText('');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Column 1: Valve Audition & Acoustic Physics Sliders */}
      <div className="flex flex-col gap-6">
        {/* Valve Audition Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h3 className="text-base font-semibold text-card-foreground">
                Valve Landmark Audition
              </h3>
            </CardTitle>
            <CardDescription>
              Snap the virtual stethoscope to anatomical valve landmarks to audition baseline
              acoustics.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {(Object.keys(VALVE_LABELS) as LocationId[]).map((id) => {
                const info = VALVE_LABELS[id];
                const isActive = selectedLandmarkId === id;
                return (
                  <Button
                    key={id}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    className="flex flex-col h-auto py-2 px-2 items-center text-center gap-0.5"
                    onClick={() => {
                      selectAuditionValve(id);
                    }}
                    data-testid={`audition-valve-${id}`}
                  >
                    <span className="font-semibold text-xs">{info.name}</span>
                    <span className="text-[10px] opacity-75">{info.landmark}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Acoustic Propagation Sliders Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h3 className="text-base font-semibold text-card-foreground">Acoustic Propagation</h3>
            </CardTitle>
            <CardDescription>
              Calibrate sound transmission across the thorax and precordium.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <AcousticSlider
              label="Valve Spread Radius (σ)"
              badge={`${acoustics.sigma.toFixed(2)} units`}
              description="Controls the Gaussian acoustic width around each valve orifice."
              value={acoustics.sigma}
              min={0.05}
              max={0.5}
              step={0.01}
              testId="slider-sigma"
              presets={[
                { label: '0.10', value: 0.1 },
                { label: '0.16', value: 0.16 },
                { label: '0.28', value: 0.28 },
              ]}
              onChange={(val) => {
                setAcousticParam('sigma', val);
              }}
            />

            <AcousticSlider
              label="Distance Falloff (50% Volume)"
              badge={`${acoustics.falloffHalfDist.toFixed(2)} m`}
              description="Distance where sound volume halves as the stethoscope moves away from the heart."
              value={acoustics.falloffHalfDist}
              min={0.1}
              max={1.0}
              step={0.01}
              testId="slider-falloff"
              presets={[
                { label: '0.20m', value: 0.2 },
                { label: '0.35m', value: 0.35 },
                { label: '0.55m', value: 0.55 },
              ]}
              onChange={(val) => {
                setAcousticParam('falloffHalfDist', val);
              }}
            />

            <AcousticSlider
              label="Peak Clarity (Over Valve)"
              badge={`${String(Math.round(acoustics.maxFilterHz))} Hz`}
              description="Acoustic lowpass cutoff when the stethoscope is centered directly on a landmark."
              value={acoustics.maxFilterHz}
              min={1000}
              max={10000}
              step={100}
              testId="slider-max-filter"
              presets={[
                { label: '2500 Hz', value: 2500 },
                { label: '3800 Hz', value: 3800 },
                { label: '6000 Hz', value: 6000 },
              ]}
              onChange={(val) => {
                setAcousticParam('maxFilterHz', val);
              }}
            />

            <AcousticSlider
              label="Tissue Absorption Floor (Distant)"
              badge={`${String(Math.round(acoustics.minFilterHz))} Hz`}
              description="Minimum muffled lowpass frequency when auscultating distant chest/flank regions."
              value={acoustics.minFilterHz}
              min={100}
              max={800}
              step={10}
              testId="slider-min-filter"
              presets={[
                { label: '200 Hz', value: 200 },
                { label: '320 Hz', value: 320 },
                { label: '500 Hz', value: 500 },
              ]}
              onChange={(val) => {
                setAcousticParam('minFilterHz', val);
              }}
            />

            <AcousticSlider
              label="Stereo Panning Multiplier"
              badge={`${acoustics.stereoPanScale.toFixed(2)}x`}
              description="Controls subtle horizontal stereo separation across the left and right chest."
              value={acoustics.stereoPanScale}
              min={0.0}
              max={1.5}
              step={0.05}
              testId="slider-stereo-pan"
              onChange={(val) => {
                setAcousticParam('stereoPanScale', val);
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Column 2: Live Auscultation Monitor & JSON Schema Manager */}
      <div className="flex flex-col gap-6">
        {/* Live Auscultation Monitor */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h3 className="text-base font-semibold text-card-foreground">
                Live Auscultation Telemetry
              </h3>
            </CardTitle>
            <CardDescription>
              Real-time acoustics evaluated at current stethoscope coordinates.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col rounded-lg border border-border p-2.5 bg-muted/10">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Nearest Valve
                </span>
                <span className="text-sm font-bold capitalize text-primary">
                  {spatialResult.nearestValveId}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {(spatialResult.nearestValveDistance * 100).toFixed(1)} cm away
                </span>
              </div>

              <div className="flex flex-col rounded-lg border border-border p-2.5 bg-muted/10">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Auscultation Gain
                </span>
                <span className="text-sm font-bold text-foreground">
                  {String(Math.round(spatialResult.spatialGain * 100))}%
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {spatialResult.spatialGain.toFixed(2)}x volume
                </span>
              </div>

              <div className="flex flex-col rounded-lg border border-border p-2.5 bg-muted/10">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Tissue Lowpass
                </span>
                <span className="text-sm font-bold text-foreground">
                  {String(Math.round(spatialResult.tissueLowpassHz))} Hz
                </span>
                <span className="text-[11px] text-muted-foreground">Acoustic clarity</span>
              </div>

              <div className="flex flex-col rounded-lg border border-border p-2.5 bg-muted/10">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Stereo Pan
                </span>
                <span className="text-sm font-bold text-foreground">
                  {Math.abs(spatialResult.stereoPan) < 0.05
                    ? 'Center'
                    : spatialResult.stereoPan < 0
                      ? `${String(Math.round(Math.abs(spatialResult.stereoPan) * 100))}% R`
                      : `${String(Math.round(spatialResult.stereoPan * 100))}% L`}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {spatialResult.stereoPan.toFixed(2)} pan
                </span>
              </div>
            </div>

            {/* Valve Acoustic Contribution Breakdown */}
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3 bg-muted/20">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Valve Contribution Blend:
              </span>
              <div className="flex flex-col gap-1.5">
                {(Object.keys(VALVE_LABELS) as LocationId[]).map((id) => {
                  const weight = spatialResult.valveWeights[id];
                  const pct = Math.round(weight * 100);
                  return (
                    <div key={id} className="flex items-center gap-2 text-xs">
                      <span className="w-20 font-medium capitalize text-muted-foreground">
                        {VALVE_LABELS[id].name}:
                      </span>
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-150"
                          style={{ width: `${String(pct)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-muted-foreground">
                        {String(pct)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Effective Valve Component Gain Ratios */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20 text-xs">
              <div>
                <span className="text-muted-foreground">Effective S1 Gain: </span>
                <span className="font-mono font-semibold">
                  {(spatialResult.effectiveLocation.components['S1']?.gain ?? 1).toFixed(2)}x
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Effective S2 Gain: </span>
                <span className="font-mono font-semibold">
                  {(spatialResult.effectiveLocation.components['S2']?.gain ?? 1).toFixed(2)}x
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">S3 Gallop: </span>
                <span className="font-mono font-semibold">
                  {(spatialResult.effectiveLocation.components['S3']?.gain ?? 1).toFixed(2)}x
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spatial Schema Manager Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h3 className="text-base font-semibold text-card-foreground">
                Spatial Schema &amp; Configuration
              </h3>
            </CardTitle>
            <CardDescription>
              Export, import, and save schema configurations for curriculum distribution.
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
                onClick={handleDownload}
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

            {/* Readonly JSON Preview */}
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
  );
}
