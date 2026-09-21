import type { ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTunerStore } from '../../store';

const SIGNAL_SOURCES = [
  { value: 'heart-beat', label: 'Heart Sound Pulse (60Hz)' },
  { value: 'click', label: 'Valve Click (1.2kHz)' },
  { value: 'murmur', label: 'Turbulent Murmur Noise' },
  { value: 'custom', label: 'Custom Audio File (.wav / .mp3)' },
] as const;

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
    <Card>
      <CardHeader>
        <CardTitle>
          <h3 className="text-base font-semibold text-card-foreground">
            Audio Source &amp; Playback
          </h3>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Signal Source:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SIGNAL_SOURCES.map((src) => (
              <label
                key={src.value}
                className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-sm cursor-pointer transition-colors ${
                  signalSource === src.value
                    ? 'border-primary bg-primary/5 font-medium text-foreground'
                    : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                <input
                  type="radio"
                  name="signalSource"
                  value={src.value}
                  checked={signalSource === src.value}
                  onChange={() => {
                    setSignalSource(src.value);
                  }}
                  className="accent-primary size-4"
                />
                <span>{src.label}</span>
              </label>
            ))}
          </div>
        </div>

        {signalSource === 'custom' && (
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

        <div className="flex items-center gap-4 pt-2">
          <Button
            type="button"
            variant={isPlaying ? 'destructive' : 'default'}
            onClick={togglePlay}
            data-testid="play-btn"
          >
            {isPlaying ? '■ Stop' : '▶ Play Preview'}
          </Button>

          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => {
                setLoop(e.target.checked);
              }}
              className="accent-primary size-4 rounded"
            />
            Loop Playback
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
