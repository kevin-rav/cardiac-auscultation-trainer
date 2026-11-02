import type { ComponentModifier, Filter, Location, LocationId } from './schema';

export type Vector3Tuple = readonly [number, number, number];

export interface SpatialLandmark {
  readonly id: LocationId;
  readonly position: Vector3Tuple;
}

export interface SpatialAuscultationResult {
  /** Distance attenuation multiplier [0.0, 1.0] */
  readonly spatialGain: number;
  /** Cutoff frequency for soft-tissue lowpass absorption in Hz */
  readonly tissueLowpassHz: number;
  /** Stereo pan from -0.35 (right chest) to +0.35 (left chest) */
  readonly stereoPan: number;
  /** Normalized proximity weights summing to 1.0 across the 4 valve areas */
  readonly valveWeights: Readonly<Record<LocationId, number>>;
  /** Distance in 3D units to the nearest valve */
  readonly nearestValveDistance: number;
  /** Anatomical ID of the closest valve */
  readonly nearestValveId: LocationId;
  /** Synthesized Location object representing blended acoustics at this point */
  readonly effectiveLocation: Location;
}

export interface SpatialAuscultationOptions {
  /** Gaussian radiation radius around valve sites (default: 0.16) */
  readonly sigma?: number;
  /** Distance where volume is halved (default: 0.35) */
  readonly falloffHalfDist?: number;
  /** Maximum tissue filter frequency in Hz when centered on valve (default: 3800) */
  readonly maxFilterHz?: number;
  /** Minimum tissue filter frequency in Hz when far away (default: 320) */
  readonly minFilterHz?: number;
  /** Distance scale for tissue lowpass filter roll-off (default: 0.30) */
  readonly filterRollOffDist?: number;
}

const DEFAULT_LANDMARKS: readonly SpatialLandmark[] = [
  { id: 'aortic', position: [-0.08, 1.442, 0.264] },
  { id: 'pulmonic', position: [0.205, 1.446, 0.278] },
  { id: 'tricuspid', position: [0.004, 1.109, 0.316] },
  { id: 'mitral', position: [0.321, 1.023, 0.299] },
];

const KNOWN_COMPONENTS = [
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
] as const;

export function calculateEuclideanDistance(p1: Vector3Tuple, p2: Vector3Tuple): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  const dz = p1[2] - p2[2];
  return Math.hypot(dx, dy, dz);
}

/**
 * Calculates continuous spatial auscultation properties based on stethoscope 3D coordinates.
 * Computes valve proximity weighting, soft-tissue acoustic lowpass absorption,
 * distance attenuation, stereo panning, and dynamic component blending.
 */
export function calculateSpatialAuscultation(
  stethoscopePos: Vector3Tuple,
  locations: Readonly<Record<LocationId, Location>>,
  customLandmarks?: readonly SpatialLandmark[],
  options?: SpatialAuscultationOptions,
): SpatialAuscultationResult {
  const landmarks = customLandmarks ?? DEFAULT_LANDMARKS;
  const sigma = options?.sigma ?? 0.16;
  const falloffHalfDist = options?.falloffHalfDist ?? 0.35;
  const maxFilterHz = options?.maxFilterHz ?? 3800;
  const minFilterHz = options?.minFilterHz ?? 320;
  const filterRollOffDist = options?.filterRollOffDist ?? 0.3;

  let nearestDist = Number.POSITIVE_INFINITY;
  let nearestId: LocationId = 'aortic';

  const distances: Record<LocationId, number> = {
    aortic: 0,
    pulmonic: 0,
    tricuspid: 0,
    mitral: 0,
  };

  const rawWeights: Record<LocationId, number> = {
    aortic: 0,
    pulmonic: 0,
    tricuspid: 0,
    mitral: 0,
  };

  let totalRawWeight = 0;

  for (const lm of landmarks) {
    const dist = calculateEuclideanDistance(stethoscopePos, lm.position);
    distances[lm.id] = dist;

    if (dist < nearestDist) {
      nearestDist = dist;
      nearestId = lm.id;
    }

    // Gaussian radial basis weighting
    const weight = Math.exp(-(dist * dist) / (2 * sigma * sigma));
    rawWeights[lm.id] = weight;
    totalRawWeight += weight;
  }

  // Normalize proximity weights
  const valveWeights: Record<LocationId, number> = {
    aortic: 0,
    pulmonic: 0,
    tricuspid: 0,
    mitral: 0,
  };

  if (totalRawWeight > 1e-6) {
    valveWeights.aortic = rawWeights.aortic / totalRawWeight;
    valveWeights.pulmonic = rawWeights.pulmonic / totalRawWeight;
    valveWeights.tricuspid = rawWeights.tricuspid / totalRawWeight;
    valveWeights.mitral = rawWeights.mitral / totalRawWeight;
  } else {
    valveWeights[nearestId] = 1.0;
  }

  // Distance attenuation (falloff half distance)
  const distRatio = Math.max(0, nearestDist) / falloffHalfDist;
  const spatialGain = Math.max(0, Math.min(1, 1 / (1 + Math.pow(distRatio, 2.4))));

  // Soft-tissue lowpass absorption (high frequencies absorb much faster with distance)
  const tissueLowpassHz = Math.round(
    minFilterHz + (maxFilterHz - minFilterHz) * Math.exp(-nearestDist / filterRollOffDist),
  );

  // Subtle stereo panning based on horizontal chest coordinate (-0.35 to +0.35)
  const stereoPan = Math.max(-0.35, Math.min(0.35, Number((stethoscopePos[0] * 0.8).toFixed(3))));

  // Synthesize blended Location
  const blendedComponents: Record<string, ComponentModifier> = {};
  let blendedGain = 0;
  let blendedHighpass = 0;
  let blendedLowpass = 0;
  let hasHighpass = false;
  let hasLowpass = false;

  for (const lm of landmarks) {
    const w = valveWeights[lm.id];
    const loc = locations[lm.id];
    if (w <= 0) continue;

    blendedGain += loc.gain * w;

    if (loc.filter?.highpassHz !== undefined) {
      blendedHighpass += loc.filter.highpassHz * w;
      hasHighpass = true;
    }
    if (loc.filter?.lowpassHz !== undefined) {
      blendedLowpass += loc.filter.lowpassHz * w;
      hasLowpass = true;
    }

    for (const comp of KNOWN_COMPONENTS) {
      const mod = loc.components[comp];
      const compGain = mod?.gain ?? 1;
      const compRate = mod?.playbackRate ?? 1;

      const existing = blendedComponents[comp];
      if (existing) {
        blendedComponents[comp] = {
          gain: existing.gain + compGain * w,
          playbackRate: existing.playbackRate + compRate * w,
        };
      } else {
        blendedComponents[comp] = {
          gain: compGain * w,
          playbackRate: compRate * w,
        };
      }
    }
  }

  const effectiveFilter: Filter | undefined =
    hasHighpass || hasLowpass
      ? {
          ...(hasHighpass ? { highpassHz: Math.round(blendedHighpass) } : {}),
          ...(hasLowpass ? { lowpassHz: Math.round(blendedLowpass) } : {}),
        }
      : undefined;

  const nearestLoc = locations[nearestId];
  const effectiveLocation: Location = {
    id: nearestId,
    label: nearestLoc.label,
    landmark: nearestLoc.landmark,
    gain: Number(blendedGain.toFixed(3)),
    ...(effectiveFilter ? { filter: effectiveFilter } : {}),
    components: blendedComponents,
    samples: nearestLoc.samples,
  };

  return {
    spatialGain: Number(spatialGain.toFixed(3)),
    tissueLowpassHz,
    stereoPan,
    valveWeights: {
      aortic: Number(valveWeights.aortic.toFixed(3)),
      pulmonic: Number(valveWeights.pulmonic.toFixed(3)),
      tricuspid: Number(valveWeights.tricuspid.toFixed(3)),
      mitral: Number(valveWeights.mitral.toFixed(3)),
    },
    nearestValveDistance: Number(nearestDist.toFixed(4)),
    nearestValveId: nearestId,
    effectiveLocation,
  };
}
