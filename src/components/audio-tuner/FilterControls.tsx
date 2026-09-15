import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTunerStore } from '../../store';

const HP_PRESETS = [40, 80, 150, 300, 500] as const;
const LP_PRESETS = [500, 800, 1200, 2500, 5000] as const;

export function FilterControls() {
  const soundSet = useTunerStore((s) => s.soundSet);
  const selectedEventIndex = useTunerStore((s) => s.selectedEventIndex);
  const setFilter = useTunerStore((s) => s.setFilter);

  const currentEvent = soundSet.events[selectedEventIndex];
  const filter = currentEvent?.filter;

  const highpassHz = filter?.highpassHz;
  const lowpassHz = filter?.lowpassHz;

  const handleHighpassChange = (value: number | undefined) => {
    setFilter({
      highpassHz: value,
      ...(lowpassHz !== undefined ? { lowpassHz } : {}),
    });
  };

  const handleLowpassChange = (value: number | undefined) => {
    setFilter({
      ...(highpassHz !== undefined ? { highpassHz } : {}),
      lowpassHz: value,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3 className="text-base font-semibold text-card-foreground">Filter Equalization</h3>
        </CardTitle>
        <CardDescription>
          Biquad filters applied to the active component ({currentEvent?.component ?? 'none'})
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Highpass Filter */}
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3.5 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Highpass Cutoff:
              </span>
              <Badge variant={highpassHz !== undefined ? 'default' : 'secondary'}>
                {highpassHz !== undefined ? `${highpassHz.toString()} Hz` : 'Bypassed (Off)'}
              </Badge>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                handleHighpassChange(highpassHz !== undefined ? undefined : 80);
              }}
            >
              {highpassHz !== undefined ? 'Disable' : 'Enable'}
            </Button>
          </div>

          {highpassHz !== undefined && (
            <div className="flex flex-col gap-3 pt-1">
              <Slider
                min={20}
                max={2000}
                step={10}
                value={[highpassHz]}
                onValueChange={(vals) => {
                  const val = vals[0];
                  if (val !== undefined) {
                    handleHighpassChange(val);
                  }
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                {HP_PRESETS.map((hz) => (
                  <Button
                    key={hz}
                    type="button"
                    variant={highpassHz === hz ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => {
                      handleHighpassChange(hz);
                    }}
                  >
                    {hz} Hz
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lowpass Filter */}
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3.5 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lowpass Cutoff:
              </span>
              <Badge variant={lowpassHz !== undefined ? 'default' : 'secondary'}>
                {lowpassHz !== undefined ? `${lowpassHz.toString()} Hz` : 'Bypassed (Off)'}
              </Badge>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                handleLowpassChange(lowpassHz !== undefined ? undefined : 1200);
              }}
            >
              {lowpassHz !== undefined ? 'Disable' : 'Enable'}
            </Button>
          </div>

          {lowpassHz !== undefined && (
            <div className="flex flex-col gap-3 pt-1">
              <Slider
                min={200}
                max={20000}
                step={100}
                value={[lowpassHz]}
                onValueChange={(vals) => {
                  const val = vals[0];
                  if (val !== undefined) {
                    handleLowpassChange(val);
                  }
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                {LP_PRESETS.map((hz) => (
                  <Button
                    key={hz}
                    type="button"
                    variant={lowpassHz === hz ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => {
                      handleLowpassChange(hz);
                    }}
                  >
                    {hz >= 1000 ? `${(hz / 1000).toString()} kHz` : `${hz.toString()} Hz`}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
