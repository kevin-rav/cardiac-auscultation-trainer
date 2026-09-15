import { useTunerStore } from '../../store';

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
    <section className="tuner-panel">
      <h3 className="panel-title">Filter Equalization</h3>
      <p className="panel-subtitle">
        Biquad filters applied to the active component ({currentEvent?.component ?? 'none'})
      </p>

      {/* Highpass Filter */}
      <div className="filter-group">
        <div className="filter-header">
          <label className="field-label" htmlFor="hp-slider">
            Highpass Cutoff:
          </label>
          <span className="value-badge">
            {highpassHz !== undefined ? `${highpassHz.toString()} Hz` : 'Bypassed (Off)'}
          </span>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              handleHighpassChange(highpassHz !== undefined ? undefined : 80);
            }}
          >
            {highpassHz !== undefined ? 'Disable' : 'Enable'}
          </button>
        </div>

        {highpassHz !== undefined && (
          <>
            <input
              id="hp-slider"
              type="range"
              min="20"
              max="2000"
              step="10"
              value={highpassHz}
              onChange={(e) => {
                handleHighpassChange(Number(e.target.value));
              }}
              className="slider"
            />
            <div className="preset-buttons">
              {[40, 80, 150, 300, 500].map((hz) => (
                <button
                  key={hz}
                  type="button"
                  className={`btn-pill ${highpassHz === hz ? 'active' : ''}`}
                  onClick={() => {
                    handleHighpassChange(hz);
                  }}
                >
                  {hz} Hz
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lowpass Filter */}
      <div className="filter-group">
        <div className="filter-header">
          <label className="field-label" htmlFor="lp-slider">
            Lowpass Cutoff:
          </label>
          <span className="value-badge">
            {lowpassHz !== undefined ? `${lowpassHz.toString()} Hz` : 'Bypassed (Off)'}
          </span>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              handleLowpassChange(lowpassHz !== undefined ? undefined : 1200);
            }}
          >
            {lowpassHz !== undefined ? 'Disable' : 'Enable'}
          </button>
        </div>

        {lowpassHz !== undefined && (
          <>
            <input
              id="lp-slider"
              type="range"
              min="200"
              max="20000"
              step="100"
              value={lowpassHz}
              onChange={(e) => {
                handleLowpassChange(Number(e.target.value));
              }}
              className="slider"
            />
            <div className="preset-buttons">
              {[500, 800, 1200, 2500, 5000].map((hz) => (
                <button
                  key={hz}
                  type="button"
                  className={`btn-pill ${lowpassHz === hz ? 'active' : ''}`}
                  onClick={() => {
                    handleLowpassChange(hz);
                  }}
                >
                  {hz >= 1000 ? `${(hz / 1000).toString()} kHz` : `${hz.toString()} Hz`}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
