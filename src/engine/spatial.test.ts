import { describe, expect, it } from 'vitest';
import { locationsRecord, spatialConfig } from '../data';
import type { SpatialConfig } from './schema';
import {
  calculateEuclideanDistance,
  calculateSpatialAuscultation,
  type Vector3Tuple,
} from './spatial';

describe('Spatial Auscultation Engine', () => {
  it('calculates 3D Euclidean distances accurately', () => {
    expect(calculateEuclideanDistance([0, 0, 0], [0, 0, 0])).toBe(0);
    expect(calculateEuclideanDistance([0, 0, 0], [3, 4, 0])).toBe(5);
    expect(calculateEuclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('evaluates aortic landmark with aortic dominance, high clarity, and high S2', () => {
    const aorticPos: Vector3Tuple = [-0.08, 1.442, 0.264];
    const result = calculateSpatialAuscultation(aorticPos, locationsRecord);

    expect(result.nearestValveId).toBe('aortic');
    expect(result.nearestValveDistance).toBeCloseTo(0, 3);
    expect(result.spatialGain).toBeGreaterThanOrEqual(0.98);
    expect(result.valveWeights.aortic).toBeGreaterThan(0.7);
    expect(result.tissueLowpassHz).toBeGreaterThanOrEqual(3500);

    // At aortic area, S2 should be louder than S1
    const s1Gain = result.effectiveLocation.components['S1']?.gain ?? 0;
    const s2Gain = result.effectiveLocation.components['S2']?.gain ?? 0;
    expect(s2Gain).toBeGreaterThan(s1Gain);
  });

  it('evaluates mitral apex landmark with apical dominance and boosted S1/gallops', () => {
    const mitralPos: Vector3Tuple = [0.321, 1.023, 0.299];
    const result = calculateSpatialAuscultation(mitralPos, locationsRecord);

    expect(result.nearestValveId).toBe('mitral');
    expect(result.nearestValveDistance).toBeCloseTo(0, 3);
    expect(result.spatialGain).toBeGreaterThanOrEqual(0.98);
    expect(result.valveWeights.mitral).toBeGreaterThan(0.7);

    // At mitral area, S1 should be louder than S2 and gallops prominent
    const s1Gain = result.effectiveLocation.components['S1']?.gain ?? 0;
    const s2Gain = result.effectiveLocation.components['S2']?.gain ?? 0;
    const s3Gain = result.effectiveLocation.components['S3']?.gain ?? 0;
    expect(s1Gain).toBeGreaterThan(s2Gain);
    expect(s3Gain).toBeGreaterThan(1.0);
  });

  it('blends aortic and pulmonic smoothly at their midpoint', () => {
    // Midpoint between aortic [-0.08, 1.442, 0.264] and pulmonic [0.205, 1.446, 0.278]
    const midX = (-0.08 + 0.205) / 2;
    const midY = (1.442 + 1.446) / 2;
    const midZ = (0.264 + 0.278) / 2;
    const midPos: Vector3Tuple = [midX, midY, midZ];

    const result = calculateSpatialAuscultation(midPos, locationsRecord);

    // Both aortic and pulmonic should have substantial weights
    expect(result.valveWeights.aortic).toBeGreaterThan(0.3);
    expect(result.valveWeights.pulmonic).toBeGreaterThan(0.3);
    expect(result.spatialGain).toBeGreaterThan(0.8);
  });

  it('attenuates volume and rolls off high frequencies when moving away from the heart', () => {
    // Shoulder / flank position far away from precordium
    const distantPos: Vector3Tuple = [0.8, 1.9, 0.2];
    const result = calculateSpatialAuscultation(distantPos, locationsRecord);

    expect(result.nearestValveDistance).toBeGreaterThan(0.6);
    expect(result.spatialGain).toBeLessThan(0.3);
    expect(result.tissueLowpassHz).toBeLessThan(1000);
  });

  it('calculates stereo pan based on horizontal chest displacement', () => {
    const rightChest: Vector3Tuple = [-0.3, 1.3, 0.25];
    const leftChest: Vector3Tuple = [0.3, 1.3, 0.25];

    const rightResult = calculateSpatialAuscultation(rightChest, locationsRecord);
    const leftResult = calculateSpatialAuscultation(leftChest, locationsRecord);

    expect(rightResult.stereoPan).toBeLessThan(0);
    expect(leftResult.stereoPan).toBeGreaterThan(0);
  });

  it('accepts custom SpatialConfig overrides', () => {
    const aorticPos: Vector3Tuple = [-0.08, 1.442, 0.264];
    const customConfig: SpatialConfig = {
      ...spatialConfig,
      acoustics: {
        ...spatialConfig.acoustics,
        minFilterHz: 500,
        falloffHalfDist: 0.1,
      },
    };

    const distantPos: Vector3Tuple = [0.8, 1.9, 0.2];
    const normalResult = calculateSpatialAuscultation(distantPos, locationsRecord, spatialConfig);
    const customResult = calculateSpatialAuscultation(distantPos, locationsRecord, customConfig);

    // Sharper falloff means less gain
    expect(customResult.spatialGain).toBeLessThan(normalResult.spatialGain);
    // Min lowpass is higher (500 vs 320)
    expect(customResult.tissueLowpassHz).toBeGreaterThanOrEqual(500);

    const atAortic = calculateSpatialAuscultation(aorticPos, locationsRecord, customConfig);
    expect(atAortic.nearestValveId).toBe('aortic');
  });
});
