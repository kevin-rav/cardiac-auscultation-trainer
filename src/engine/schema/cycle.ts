export interface CycleParams {
  systole: {
    interceptMs: number;
    slopePerBpm: number;
    minMs: number;
    maxMs: number;
  };
}

export interface Landmarks {
  S1: number;
  S2: number;
  nextS1: number;
}

export const DEFAULT_CYCLE_PARAMS: CycleParams = {
  systole: {
    interceptMs: 546,
    slopePerBpm: 2.1,
    minMs: 200,
    maxMs: 450,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function landmarks(
  rr: number,
  params: CycleParams = DEFAULT_CYCLE_PARAMS,
): Landmarks {
  const bpm = 60_000 / rr;

  const systoleMs = clamp(
    params.systole.interceptMs - params.systole.slopePerBpm * bpm,
    params.systole.minMs,
    params.systole.maxMs,
  );

  return {
    S1: 0,
    S2: systoleMs,
    nextS1: rr,
  };
}