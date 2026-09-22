import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CYCLE_PARAMS,
  landmarks,
} from './cycle';

describe('cardiac cycle', () => {
  it('starts S1 at 0', () => {
    const result = landmarks(60);
    expect(result.S1).toBe(0);
  });

  it('calculates nextS1 from BPM', () => {
    // 60 BPM -> 1000 ms per cardiac cycle
    const result = landmarks(60);
    expect(result.nextS1).toBe(1000);
  });

  it('calculates systole from BPM', () => {
    // 546 - (2.1 * 60) = 420 ms
    const result = landmarks(60);
    expect(result.S2).toBe(420);
  });

  it('clamps systole to the minimum', () => {
    // 240 BPM -> calculated systole is below 200 ms
    const result = landmarks(240);
    expect(result.S2).toBe(DEFAULT_CYCLE_PARAMS.systole.minMs);
  });

  it('clamps systole to the maximum', () => {
    // 15 BPM -> calculated systole is above 450 ms
    const result = landmarks(15);
    expect(result.S2).toBe(DEFAULT_CYCLE_PARAMS.systole.maxMs);
  });

  it('allows custom cycle parameters', () => {
    // 60 BPM -> 500 - (2 * 60) = 380 ms
    const result = landmarks(60, {
      systole: {
        interceptMs: 500,
        slopePerBpm: 2,
        minMs: 100,
        maxMs: 400,
      },
    });

    expect(result.S2).toBe(380);
    expect(result.nextS1).toBe(1000);
  });
});