import type { MurmurShape } from './schema';

const DEFAULT_SAMPLE_COUNT = 64;
const DEFAULT_EDGE_MS = 15;

const CONTOUR_STRATEGIES: Record<MurmurShape, (fraction: number) => number> = {
  plateau: () => 1,
  crescendo: (fraction) => fraction,
  decrescendo: (fraction) => 1 - fraction,
  diamond: (fraction) => Math.sin(fraction * Math.PI),
};

/**
 * Generates an automated gain curve as a Float32Array suitable for
 * AudioParam.setValueCurveAtTime, shaping a sustained audio loop into a murmur.
 *
 * @param shape Murmur profile: plateau, crescendo, decrescendo, or diamond
 * @param durationMs Murmur event duration in milliseconds
 * @param edgeMs Attack and release ramp duration in milliseconds to prevent boundary clicks
 * @param samplePoints Number of curve points to sample (default 64)
 */
export function generateMurmurCurve(
  shape: MurmurShape,
  durationMs: number,
  edgeMs: number = DEFAULT_EDGE_MS,
  samplePoints: number = DEFAULT_SAMPLE_COUNT,
): Float32Array {
  const points = Math.max(8, samplePoints);
  const curve = new Float32Array(points);

  if (durationMs <= 0) {
    return curve;
  }

  // Ensure edge attack and release don't exceed half the duration
  const safeEdgeMs = Math.min(Math.max(0, edgeMs), durationMs / 2);
  const contourFn = CONTOUR_STRATEGIES[shape];

  for (let i = 0; i < points; i++) {
    const fraction = i / (points - 1);
    const tMs = fraction * durationMs;

    // 1. Compute shape contour S(fraction) via strategy dictionary
    const shapeFactor = contourFn(fraction);

    // 2. Compute boundary anti-click window W(tMs)
    let windowFactor = 1;
    if (safeEdgeMs > 0) {
      if (tMs < safeEdgeMs) {
        windowFactor = tMs / safeEdgeMs;
      } else if (tMs > durationMs - safeEdgeMs) {
        windowFactor = (durationMs - tMs) / safeEdgeMs;
      }
    }

    curve[i] = Math.max(0, Math.min(1, shapeFactor * windowFactor));
  }

  return curve;
}
