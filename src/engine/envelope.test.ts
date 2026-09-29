import { describe, expect, it } from 'vitest';
import { generateMurmurCurve } from './envelope';

describe('generateMurmurCurve', () => {
  it('returns empty curve for zero or negative duration', () => {
    const curve = generateMurmurCurve('plateau', 0);
    expect(curve[0]).toBe(0);
    expect(curve[curve.length - 1]).toBe(0);
  });

  it('generates plateau curve with zero gain at boundary edges and 1.0 in steady state', () => {
    // 200 ms duration, 20 ms edges, 64 points
    const curve = generateMurmurCurve('plateau', 200, 20, 64);
    expect(curve[0]).toBe(0);
    expect(curve[curve.length - 1]).toBe(0);

    // Center of the plateau should be 1.0
    const midIndex = Math.floor(curve.length / 2);
    expect(curve[midIndex]).toBeCloseTo(1.0, 2);
  });

  it('generates crescendo curve ramping up smoothly to peak', () => {
    const curve = generateMurmurCurve('crescendo', 200, 10, 64);
    expect(curve[0]).toBe(0);

    // Quarter point should be lower than three-quarter point
    const quarter = Math.floor(curve.length / 4);
    const threeQuarter = Math.floor((curve.length * 3) / 4);
    expect(curve[quarter] ?? 0).toBeLessThan(curve[threeQuarter] ?? 0);
  });

  it('generates decrescendo curve starting high and ramping down', () => {
    const curve = generateMurmurCurve('decrescendo', 200, 10, 64);
    expect(curve[curve.length - 1]).toBe(0);

    const quarter = Math.floor(curve.length / 4);
    const threeQuarter = Math.floor((curve.length * 3) / 4);
    expect(curve[quarter] ?? 0).toBeGreaterThan(curve[threeQuarter] ?? 0);
  });

  it('generates diamond (crescendo-decrescendo) curve peaking around the midpoint', () => {
    const curve = generateMurmurCurve('diamond', 200, 15, 65);
    expect(curve[0]).toBe(0);
    expect(curve[curve.length - 1]).toBe(0);

    const midIndex = 32; // exactly middle of 65 points (0-indexed)
    const peak = curve[midIndex] ?? 0;
    expect(peak).toBeGreaterThan(0.9);

    // Left and right shoulders are lower than the peak
    expect(curve[16] ?? 0).toBeLessThan(peak);
    expect(curve[48] ?? 0).toBeLessThan(peak);
  });
});
