import type {
  ComponentModifier,
  Filter,
  Location,
  LocationId,
  SpatialConfig,
  SpatialLandmark,
} from './schema';

export type Vector3Tuple = readonly [number, number, number];

export interface SpatialAuscultationResult {
  readonly spatialGain: number;
  readonly tissueLowpassHz: number;
  readonly stereoPan: number;
  readonly valveWeights: Readonly<Record<LocationId, number>>;
  readonly nearestValveDistance: number;
  readonly nearestValveId: LocationId;
  readonly effectiveLocation: Location;
}

const DEFAULT_LANDMARKS: readonly SpatialLandmark[] = [
  { id: 'aortic', label: 'Aortic Area (2nd ICS RSB)', position: [-0.08, 1.442, 0.264] },
  { id: 'pulmonic', label: 'Pulmonic Area (2nd ICS LSB)', position: [0.205, 1.446, 0.278] },
  { id: 'tricuspid', label: 'Tricuspid Area (4th-5th ICS LSB)', position: [0.004, 1.109, 0.316] },
  { id: 'mitral', label: 'Mitral Area / Apex (5th ICS MCL)', position: [0.321, 1.023, 0.299] },
];

export function calculateEuclideanDistance(p1: Vector3Tuple, p2: Vector3Tuple): number {
  return Math.hypot(p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]);
}

/**
 * Calculates continuous spatial auscultation properties based on stethoscope 3D coordinates.
 * Computes valve proximity weighting, soft-tissue acoustic lowpass absorption,
 * distance attenuation, stereo panning, and dynamic component blending.
 */
export function calculateSpatialAuscultation(
  stethoscopePos: Vector3Tuple,
  locations: Readonly<Record<LocationId, Location>>,
  config?: SpatialConfig | readonly SpatialLandmark[],
): SpatialAuscultationResult {
  const isConfig = config && 'acoustics' in config && 'landmarks' in config;
  const landmarks: readonly SpatialLandmark[] = isConfig
    ? config.landmarks
    : (config ?? DEFAULT_LANDMARKS);
  const acoustics = isConfig ? config.acoustics : undefined;

  const sigma = acoustics?.sigma ?? 0.16;
  const falloffHalfDist = acoustics?.falloffHalfDist ?? 0.35;
  const maxFilterHz = acoustics?.maxFilterHz ?? 3800;
  const minFilterHz = acoustics?.minFilterHz ?? 320;
  const filterRollOffDist = acoustics?.filterRollOffDist ?? 0.3;
  const panScale = acoustics?.stereoPanScale ?? 0.8;

  let nearestDist = Number.POSITIVE_INFINITY;
  let nearestId: LocationId = 'aortic';

  const distances: Record<LocationId, number> = { aortic: 0, pulmonic: 0, tricuspid: 0, mitral: 0 };
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
    const weight = Math.exp(-(dist * dist) / (2 * sigma * sigma));
    rawWeights[lm.id] = weight;
    totalRawWeight += weight;
  }

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

  // Distance attenuation
  const distRatio = Math.max(0, nearestDist) / falloffHalfDist;
  const spatialGain = Math.max(0, Math.min(1, 1 / (1 + Math.pow(distRatio, 2.4))));

  // Soft-tissue lowpass absorption
  const tissueLowpassHz = Math.round(
    minFilterHz + (maxFilterHz - minFilterHz) * Math.exp(-nearestDist / filterRollOffDist),
  );

  // Subtle stereo panning across the chest
  const stereoPan = Math.max(
    -0.35,
    Math.min(0.35, Number((stethoscopePos[0] * panScale).toFixed(3))),
  );

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

    for (const [comp, mod] of Object.entries(loc.components)) {
      const compGain = mod.gain;
      const compRate = mod.playbackRate;
      const existing = blendedComponents[comp];
      blendedComponents[comp] = existing
        ? { gain: existing.gain + compGain * w, playbackRate: existing.playbackRate + compRate * w }
        : { gain: compGain * w, playbackRate: compRate * w };
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
