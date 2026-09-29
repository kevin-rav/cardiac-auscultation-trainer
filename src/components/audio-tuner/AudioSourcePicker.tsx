import type { ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useTunerStore } from '../../store';

const AUDIO_SOURCES = [
  { value: 'event-sample', label: 'Selected Event Sample (Auto)' },
  { value: 's1-apex', label: 'S1 Sample (s1-apex.wav)' },
  { value: 's2-base', label: 'S2 Sample (s2-base.wav)' },
  { value: 's3', label: 'S3 Sample (s3.wav)' },
  { value: 's4', label: 'S4 Sample (s4.wav)' },
  { value: 'click', label: 'Click Sample (click.wav)' },
  { value: 'murmur-noise', label: 'Murmur Noise (murmur-noise.wav)' },
  { value: 'custom', label: 'Custom Audio File (.wav / .mp3)' },
] as const;

export function AudioSourcePicker() {
  const signalSource = useTunerStore((s) => s.signalSource);
  const customFileName = useTunerStore((s) => s.customFileName);
  const isPlaying = useTunerStore((s) => s.isPlaying);
  const loop = useTunerStore((s) => s.loop);
  const bpm = useTunerStore((s) => s.bpm);
  const playbackMode = useTunerStore((s) => s.playbackMode);
  const setPlaybackMode = useTunerStore((s) => s.setPlaybackMode);
  const setSignalSource = useTunerStore((s) => s.setSignalSource);
  const setLoop = useTunerStore((s) => s.setLoop);
  const setBpm = useTunerStore((s) => s.setBpm);
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
    <Card>
      <CardHeader>
        <CardTitle>
          <h3 className="text-base font-semibold text-card-foreground">
            Audio Source &amp; Playback
          </h3>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Playback Mode Switcher */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Playback Mode:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={playbackMode === 'full-cycle' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setPlaybackMode('full-cycle');
              }}
              data-testid="mode-full-cycle"
            >
              Full Cardiac Cycle
            </Button>
            <Button
              type="button"
              variant={playbackMode === 'isolated' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setPlaybackMode('isolated');
              }}
              data-testid="mode-isolated"
            >
              Isolated Event
            </Button>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {playbackMode === 'full-cycle'
              ? 'Simulates complete cardiac cycle (S1, S2, murmurs, gallops) with physiological timing.'
              : 'Auditions the single selected event sample in isolation for filter/gain tuning.'}
          </span>
        </div>

        {playbackMode === 'isolated' ? (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="audio-source-select"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Audio Sample Source:
            </label>
            <select
              id="audio-source-select"
              className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              value={signalSource}
              onChange={(e) => {
                setSignalSource(e.target.value as (typeof AUDIO_SOURCES)[number]['value']);
              }}
            >
              {AUDIO_SOURCES.map((src) => (
                <option key={src.value} value={src.value}>
                  {src.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {playbackMode === 'isolated' && signalSource === 'custom' && (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4 bg-muted/20">
            <label
              htmlFor="audio-file-input"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              Upload Audio Sample:
            </label>
            <input
              id="audio-file-input"
              type="file"
              accept="audio/wav, audio/mpeg, audio/mp3, audio/ogg"
              onChange={handleFileUpload}
              className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
            {customFileName && (
              <p className="text-xs text-muted-foreground">
                Loaded: <span className="font-semibold text-foreground">{customFileName}</span>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant={isPlaying ? 'destructive' : 'default'}
              onClick={togglePlay}
              data-testid="play-btn"
            >
              {isPlaying
                ? '■ Stop'
                : playbackMode === 'full-cycle'
                  ? '▶ Play Cardiac Cycle'
                  : '▶ Play Preview'}
            </Button>

            {playbackMode === 'isolated' && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(e) => {
                    setLoop(e.target.checked);
                  }}
                  className="accent-primary size-4 rounded"
                  data-testid="loop-checkbox"
                />
                Loop Playback
              </label>
            )}
          </div>

          {/* Heart Rate / BPM Controls */}
          <div
            className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors ${
              loop ? 'border-border bg-muted/20' : 'border-border/50 bg-muted/10 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between">
              <label
                htmlFor="bpm-slider"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              >
                Heart Rate / BPM:
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  ({(60 / bpm).toFixed(2)}s cycle)
                </span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {bpm} BPM
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Slider
                id="bpm-slider"
                min={30}
                max={220}
                step={1}
                value={[bpm]}
                onValueChange={(vals) => {
                  const val = vals[0];
                  if (val !== undefined) {
                    setBpm(val);
                  }
                }}
                aria-label="Heart rate in beats per minute"
                className="flex-1"
              />
              <input
                type="number"
                min={30}
                max={220}
                value={bpm}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!Number.isNaN(val)) {
                    setBpm(val);
                  }
                }}
                className="flex h-8 w-16 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono text-center shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Numeric BPM input"
                data-testid="bpm-input"
              />
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground">Presets:</span>
              {[60, 72, 90, 120].map((presetBpm) => (
                <Button
                  key={presetBpm}
                  type="button"
                  variant={bpm === presetBpm ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => {
                    setBpm(presetBpm);
                  }}
                >
                  {presetBpm}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
