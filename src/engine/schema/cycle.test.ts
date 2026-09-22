import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CYCLE_PARAMS,
  landmarks,
} from './cycle';

describe('cardiac cycle', () => {
  it('starts S1 at 0', () => {
    const result = landmarks(1000);

    expect(result.S1).toBe(0);
  });

  it('sets nextS1 to the RR interval', () => {
    const result = landmarks(1000);

    expect(result.nextS1).toBe(1000);
  });

  it('calculates systole from BPM', () => {
    // RR = 1000 ms -> 60 BPM
    // 546 - (2.1 * 60) = 420 ms
    const result = landmarks(1000);

    expect(result.S2).toBe(420);
  });

  it('clamps systole to the minimum', () => {
    // Very high BPM produces a value below the minimum.
    const result = landmarks(250);

    expect(result.S2).toBe(DEFAULT_CYCLE_PARAMS.systole.minMs);
  });

  it('clamps systole to the maximum', () => {
    // Very low BPM produces a value above the maximum.
    const result = landmarks(4000);

    expect(result.S2).toBe(DEFAULT_CYCLE_PARAMS.systole.maxMs);
  });

  it('allows custom cycle parameters', () => {
    const result = landmarks(1000, {
      systole: {
        interceptMs: 500,
        slopePerBpm: 2,
        minMs: 100,
        maxMs: 400,
      },
    });

    // 60 BPM -> 500 - (2 * 60) = 380 ms
    expect(result.S2).toBe(380);
  });
});