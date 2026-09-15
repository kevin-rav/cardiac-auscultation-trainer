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
    <section className="tuner-panel">
      <div className="events-header">
        <h3 className="panel-title">Sound Set Events</h3>
        <div className="event-action-buttons">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              addEvent('transient');
            }}
          >
            + Add Transient
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              addEvent('murmur');
            }}
          >
            + Add Murmur
          </button>
        </div>
      </div>

      {/* Event Tabs */}
      <div className="event-tabs">
        {soundSet.events.map((ev, idx) => (
          <button
            key={`${ev.component}-${idx.toString()}`}
            type="button"
            className={`event-tab ${selectedEventIndex === idx ? 'active' : ''}`}
            onClick={() => {
              selectEvent(idx);
            }}
          >
            <span className="event-tab-type">[{ev.kind === 'transient' ? 'T' : 'M'}]</span>
            {ev.component}
          </button>
        ))}
      </div>

      <div className="event-details-card">
        <div className="card-top-row">
          <span className="badge-kind">Type: {currentEvent.kind.toUpperCase()}</span>
          {soundSet.events.length > 1 && (
            <button
              type="button"
              className="btn-danger-outline btn-sm"
              onClick={() => {
                removeEvent(selectedEventIndex);
              }}
            >
              Delete Event
            </button>
          )}
        </div>

        <div className="grid-2col">
          <div className="field-group">
            <label htmlFor="comp-select" className="field-label">
              Component Role:
            </label>
            <select
              id="comp-select"
              className="select-input"
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

          <div className="field-group">
            <label htmlFor="sample-input" className="field-label">
              Sample ID:
            </label>
            <input
              id="sample-input"
              type="text"
              className="text-input"
              value={currentEvent.sample}
              onChange={(e) => {
                handleSampleChange(e.target.value);
              }}
            />
          </div>
        </div>

        {/* Gain Control */}
        <div className="field-group">
          <div className="field-header">
            <label htmlFor="gain-slider" className="field-label">
              Gain Multiplier:
            </label>
            <span className="value-badge">
              {currentEvent.gain.toFixed(2)}x ({gainDb} dB)
            </span>
          </div>
          <input
            id="gain-slider"
            type="range"
            min="0"
            max="4"
            step="0.05"
            value={currentEvent.gain}
            onChange={(e) => {
              setGain(Number(e.target.value));
            }}
            className="slider"
          />
        </div>

        {/* Transient-specific controls */}
        {currentEvent.kind === 'transient' && (
          <div className="field-group">
            <div className="field-header">
              <label htmlFor="rate-slider" className="field-label">
                Playback Rate / Pitch:
              </label>
              <span className="value-badge">{currentEvent.playbackRate.toFixed(2)}x</span>
            </div>
            <input
              id="rate-slider"
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={currentEvent.playbackRate}
              onChange={(e) => {
                setPlaybackRate(Number(e.target.value));
              }}
              className="slider"
            />
          </div>
        )}

        {/* Murmur-specific controls */}
        {currentEvent.kind === 'murmur' && (
          <div className="grid-2col">
            <div className="field-group">
              <label htmlFor="shape-select" className="field-label">
                Murmur Envelope Shape:
              </label>
              <select
                id="shape-select"
                className="select-input"
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

            <div className="field-group">
              <label htmlFor="edge-input" className="field-label">
                Edge Smoothing (ms):
              </label>
              <input
                id="edge-input"
                type="number"
                min="0"
                max="100"
                className="text-input"
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
    </section>
  );
}
