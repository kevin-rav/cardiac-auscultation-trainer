import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTunerStore, type Component, type MurmurShape } from '../../store';

const COMPONENT_OPTIONS: Component[] = [
  'S1',
  'S2',
  'S3',
  'S4',
  'click',
  'openingSnap',
  'ejectionClick',
  'systolicMurmur',
  'diastolicMurmur',
  'continuousMurmur',
  'rub',
];

const MURMUR_SHAPES: MurmurShape[] = ['plateau', 'crescendo', 'decrescendo', 'diamond'];

export function ParameterControls() {
  const soundSet = useTunerStore((s) => s.soundSet);
  const selectedEventIndex = useTunerStore((s) => s.selectedEventIndex);
  const selectEvent = useTunerStore((s) => s.selectEvent);
  const updateEvent = useTunerStore((s) => s.updateEvent);
  const addEvent = useTunerStore((s) => s.addEvent);
  const removeEvent = useTunerStore((s) => s.removeEvent);
  const setGain = useTunerStore((s) => s.setGain);
  const setPlaybackRate = useTunerStore((s) => s.setPlaybackRate);

  const currentEvent = soundSet.events[selectedEventIndex];

  if (!currentEvent) {
    return null;
  }

  const gainDb = currentEvent.gain > 0 ? (20 * Math.log10(currentEvent.gain)).toFixed(1) : '-∞';

  const handleComponentChange = (newComp: Component) => {
    updateEvent(selectedEventIndex, {
      ...currentEvent,
      component: newComp,
    });
  };

  const handleSampleChange = (newSample: string) => {
    updateEvent(selectedEventIndex, {
      ...currentEvent,
      sample: newSample,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            <h3 className="text-base font-semibold text-card-foreground">Sound Set Events</h3>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                addEvent('transient');
              }}
            >
              + Add Transient
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                addEvent('murmur');
              }}
            >
              + Add Murmur
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Event Tabs */}
        <Tabs
          value={selectedEventIndex.toString()}
          onValueChange={(val) => {
            selectEvent(Number(val));
          }}
        >
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted p-1">
            {soundSet.events.map((ev, idx) => (
              <TabsTrigger
                key={`${ev.component}-${idx.toString()}`}
                value={idx.toString()}
                className="gap-1.5"
              >
                <Badge variant="secondary" className="px-1 py-0 text-[10px] font-semibold">
                  {ev.kind === 'transient' ? 'T' : 'M'}
                </Badge>
                <span>{ev.component}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Event Details Card */}
        <div className="flex flex-col gap-4 rounded-lg border border-border p-4 bg-muted/20">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="font-semibold">
              Type: {currentEvent.kind.toUpperCase()}
            </Badge>
            {soundSet.events.length > 1 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  removeEvent(selectedEventIndex);
                }}
              >
                Delete Event
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="comp-select"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              >
                Component Role:
              </label>
              <select
                id="comp-select"
                className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                value={currentEvent.component}
                onChange={(e) => {
                  handleComponentChange(e.target.value as Component);
                }}
              >
                {COMPONENT_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="sample-input"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              >
                Sample ID:
              </label>
              <input
                id="sample-input"
                type="text"
                className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                value={currentEvent.sample}
                onChange={(e) => {
                  handleSampleChange(e.target.value);
                }}
              />
            </div>
          </div>

          {/* Gain Control */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="gain-slider"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              >
                Gain Multiplier:
              </label>
              <Badge variant="secondary">
                {currentEvent.gain.toFixed(2)}x ({gainDb} dB)
              </Badge>
            </div>
            <Slider
              id="gain-slider"
              min={0}
              max={4}
              step={0.05}
              value={[currentEvent.gain]}
              onValueChange={(vals) => {
                const val = vals[0];
                if (val !== undefined) {
                  setGain(val);
                }
              }}
            />
          </div>

          {/* Transient-specific controls */}
          {currentEvent.kind === 'transient' && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="rate-slider"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Playback Rate / Pitch:
                </label>
                <Badge variant="secondary">{currentEvent.playbackRate.toFixed(2)}x</Badge>
              </div>
              <Slider
                id="rate-slider"
                min={0.5}
                max={2.0}
                step={0.05}
                value={[currentEvent.playbackRate]}
                onValueChange={(vals) => {
                  const val = vals[0];
                  if (val !== undefined) {
                    setPlaybackRate(val);
                  }
                }}
              />
            </div>
          )}

          {/* Murmur-specific controls */}
          {currentEvent.kind === 'murmur' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="shape-select"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Murmur Envelope Shape:
                </label>
                <select
                  id="shape-select"
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={currentEvent.shape}
                  onChange={(e) => {
                    updateEvent(selectedEventIndex, {
                      ...currentEvent,
                      shape: e.target.value as MurmurShape,
                    });
                  }}
                >
                  {MURMUR_SHAPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="edge-input"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Edge Smoothing (ms):
                </label>
                <input
                  id="edge-input"
                  type="number"
                  min="0"
                  max="100"
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={currentEvent.edgeMs}
                  onChange={(e) => {
                    updateEvent(selectedEventIndex, {
                      ...currentEvent,
                      edgeMs: Number(e.target.value),
                    });
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
