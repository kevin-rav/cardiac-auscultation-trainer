import type { Rhythm } from './schema';

export interface Beat {
  readonly index: number;
  /** Start time on the audio clock, seconds. */
  readonly start: number;
  /** Interval to the next beat, ms. */
  readonly rr: number;
  /** Instantaneous heart rate in BPM for landmark calculations. */
  readonly bpm: number;
  /** False for a non-conducted beat: no ventricular sounds, only the silent gap. */
  readonly conducted: boolean;
  /** False when there is no effective atrial contraction. Suppresses S4 gallop. */
  readonly atrialKick: boolean;
}

export type BeatGenerator = Generator<Beat, void, undefined>;

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 */
function createPrng(seed: number): () => number {
  let s = Math.floor(seed) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform yielding normally distributed random numbers with mean 0 and std 1.
 */
function nextGaussian(random: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Generates regular sinus rhythm beats with exact intervals.
 */
export function* createRegularBeatGenerator(bpm: number, startTimeSec = 0): BeatGenerator {
  const safeBpm = Math.max(30, Math.min(220, bpm));
  const rrMs = (60 / safeBpm) * 1000;
  const rrSec = rrMs / 1000;

  let index = 0;
  let currentTimeSec = startTimeSec;

  for (;;) {
    yield {
      index,
      start: currentTimeSec,
      rr: rrMs,
      bpm: safeBpm,
      conducted: true,
      atrialKick: true,
    };
    currentTimeSec += rrSec;
    index++;
  }
}

/**
 * Generates irregularly irregular beats (e.g. Atrial Fibrillation) with
 * normal RR interval variation.
 */
export function* createIrregularBeatGenerator(
  baseBpm: number,
  variability = 0.25,
  atrialKick = false,
  startTimeSec = 0,
  seed = 42,
): BeatGenerator {
  const safeBpm = Math.max(30, Math.min(220, baseBpm));
  const meanRrMs = (60 / safeBpm) * 1000;
  const stdDevMs = meanRrMs * Math.max(0, Math.min(1, variability));
  const random = createPrng(seed);

  let index = 0;
  let currentTimeSec = startTimeSec;

  for (;;) {
    const delta = nextGaussian(random) * stdDevMs;
    // Clamp RR between 270 ms (~220 BPM) and 1500 ms (~40 BPM)
    const rrMs = Math.min(1500, Math.max(270, Math.round(meanRrMs + delta)));
    const instantaneousBpm = Math.round(60000 / rrMs);

    yield {
      index,
      start: currentTimeSec,
      rr: rrMs,
      bpm: instantaneousBpm,
      conducted: true,
      atrialKick,
    };

    currentTimeSec += rrMs / 1000;
    index++;
  }
}

/**
 * Generates rhythm with periodic conduction block (e.g. 2:1 AV block).
 */
export function* createBlockedBeatGenerator(
  bpm: number,
  conductEvery = 2,
  startTimeSec = 0,
): BeatGenerator {
  const safeBpm = Math.max(30, Math.min(220, bpm));
  const rrMs = (60 / safeBpm) * 1000;
  const rrSec = rrMs / 1000;
  const n = Math.max(2, conductEvery);

  let index = 0;
  let currentTimeSec = startTimeSec;

  for (;;) {
    // Every nth beat is not conducted
    const isConducted = (index + 1) % n !== 0;

    yield {
      index,
      start: currentTimeSec,
      rr: rrMs,
      bpm: safeBpm,
      conducted: isConducted,
      atrialKick: true,
    };

    currentTimeSec += rrSec;
    index++;
  }
}

/**
 * Generates rhythm ramping smoothly from initial BPM to target BPM over a given duration.
 */
export function* createRampBeatGenerator(
  fromBpm: number,
  toBpm: number,
  durationSec: number,
  startTimeSec = 0,
): BeatGenerator {
  let index = 0;
  let currentTimeSec = startTimeSec;
  const rampDuration = Math.max(1, durationSec);

  for (;;) {
    const elapsed = Math.max(0, currentTimeSec - startTimeSec);
    const progress = Math.min(1, elapsed / rampDuration);
    const currentBpm = Math.round(fromBpm + (toBpm - fromBpm) * progress);
    const rrMs = (60 / currentBpm) * 1000;

    yield {
      index,
      start: currentTimeSec,
      rr: rrMs,
      bpm: currentBpm,
      conducted: true,
      atrialKick: true,
    };

    currentTimeSec += rrMs / 1000;
    index++;
  }
}

/**
 * Factory dispatching the appropriate rhythm generator based on a Rhythm definition.
 */
export function createBeatGenerator(
  rhythm: Rhythm,
  bpm: number,
  startTimeSec = 0,
  seed?: number,
): BeatGenerator {
  switch (rhythm.type) {
    case 'regular':
      return createRegularBeatGenerator(bpm, startTimeSec);
    case 'irregular':
      return createIrregularBeatGenerator(
        bpm,
        rhythm.variability,
        rhythm.atrialKick,
        startTimeSec,
        seed ?? 42,
      );
    case 'blocked':
      return createBlockedBeatGenerator(bpm, rhythm.conductEvery, startTimeSec);
    case 'ramp':
      return createRampBeatGenerator(bpm, rhythm.toBpm, rhythm.seconds, startTimeSec);
  }
}
