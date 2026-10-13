import type { CycleParams, Landmark, Position } from './schema';

export interface CycleLandmarks {
  readonly S1: number;
  readonly S2: number;
  readonly nextS1: number;
  readonly systoleMs: number;
  readonly diastoleMs: number;
  readonly rrMs: number;
  readonly bpm: number;
}

const DEFAULT_SYSTOLE_INTERCEPT_MS = 546;
const DEFAULT_SYSTOLE_SLOPE = 2.1;
const DEFAULT_MIN_SYSTOLE_MS = 200;
const DEFAULT_MAX_SYSTOLE_MS = 450;
const MIN_SYSTOLE_MARGIN_MS = 50;

/**
 * Calculates electromechanical systole duration (approximate S1-to-S2 interval)
 * using Weissler's regression formula clamped to physiologically valid bounds:
 * systoleMs = clamp(546 - 2.1 * bpm, 200, 450)
 */
export function calculateSystoleMs(bpm: number, params?: CycleParams['systole']): number {
  const intercept = params?.interceptMs ?? DEFAULT_SYSTOLE_INTERCEPT_MS;
  const slope = params?.slopePerBpm ?? DEFAULT_SYSTOLE_SLOPE;
  const minMs = params?.minMs ?? DEFAULT_MIN_SYSTOLE_MS;
  const maxMs = params?.maxMs ?? DEFAULT_MAX_SYSTOLE_MS;

  const rawSystole = intercept - slope * bpm;
  return Math.min(maxMs, Math.max(minMs, Math.round(rawSystole)));
}

/**
 * Computes all landmark timing points and interval durations for a beat.
 */
export function calculateLandmarks(
  rrMs: number,
  bpm: number,
  params?: CycleParams['systole'],
): CycleLandmarks {
  const systoleMs = calculateSystoleMs(bpm, params);
  const clampedSystole = Math.min(
    systoleMs,
    Math.max(MIN_SYSTOLE_MARGIN_MS, rrMs - MIN_SYSTOLE_MARGIN_MS),
  );
  const diastoleMs = Math.max(0, rrMs - clampedSystole);

  return {
    S1: 0,
    S2: clampedSystole,
    nextS1: rrMs,
    systoleMs: clampedSystole,
    diastoleMs,
    rrMs,
    bpm,
  };
}

interface AnchorInterval {
  readonly base: (l: CycleLandmarks) => number;
  readonly duration: (l: CycleLandmarks) => number;
}

const ANCHOR_RESOLVERS: Record<Landmark, AnchorInterval> = {
  S1: { base: (l) => l.S1, duration: (l) => l.systoleMs },
  S2: { base: (l) => l.S2, duration: (l) => l.diastoleMs },
  nextS1: { base: (l) => l.nextS1, duration: () => 0 },
};

/**
 * Resolves a Position descriptor (anchor + ms or fraction) into exact milliseconds
 * relative to the start of the cardiac cycle (S1 = 0 ms).
 */
export function resolvePositionMs(position: Position, landmarks: CycleLandmarks): number {
  const { anchor, ms = 0, fraction } = position;
  const resolver = ANCHOR_RESOLVERS[anchor];
  const offset = fraction !== undefined ? fraction * resolver.duration(landmarks) : ms;
  return Math.round(resolver.base(landmarks) + offset);
}
