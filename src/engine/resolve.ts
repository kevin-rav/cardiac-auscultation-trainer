import type {
  Component,
  Filter,
  Location,
  Manifest,
  MurmurShape,
  Position,
  SoundEvent,
  SoundSet,
} from './schema';

export interface ResolvedTransientEvent {
  readonly kind: 'transient';
  readonly component: Component;
  readonly sampleId: string;
  readonly at: Position;
  readonly gain: number;
  readonly playbackRate: number;
  readonly filter?: Filter | undefined;
}

export interface ResolvedMurmurEvent {
  readonly kind: 'murmur';
  readonly component: Component;
  readonly sampleId: string;
  readonly from: Position;
  readonly to: Position;
  readonly shape: MurmurShape;
  readonly gain: number;
  readonly edgeMs: number;
  readonly filter?: Filter | undefined;
}

export type ResolvedEvent = ResolvedTransientEvent | ResolvedMurmurEvent;

/**
 * Converts a decibel trim value into a linear gain multiplier:
 * 10^(trimDb / 20)
 */
export function dbToLinearGain(trimDb: number): number {
  return Math.pow(10, trimDb / 20);
}

/**
 * Combines highpass and lowpass filters by taking the most restrictive cutoff:
 * maximum frequency for highpass and minimum frequency for lowpass.
 */
function mergeFilters(...filters: readonly (Filter | undefined)[]): Filter | undefined {
  let highpassHz: number | undefined;
  let lowpassHz: number | undefined;

  for (const filter of filters) {
    if (!filter) continue;
    if (filter.highpassHz !== undefined) {
      highpassHz =
        highpassHz !== undefined ? Math.max(highpassHz, filter.highpassHz) : filter.highpassHz;
    }
    if (filter.lowpassHz !== undefined) {
      lowpassHz =
        lowpassHz !== undefined ? Math.min(lowpassHz, filter.lowpassHz) : filter.lowpassHz;
    }
  }

  if (highpassHz === undefined && lowpassHz === undefined) {
    return undefined;
  }

  return {
    ...(highpassHz !== undefined ? { highpassHz } : {}),
    ...(lowpassHz !== undefined ? { lowpassHz } : {}),
  };
}

/**
 * Resolves a SoundSet definition against an optional auscultation Location and sample Manifest.
 * Computes final effective gains, playback rates, filter profiles, and sample overrides.
 */
export function resolveSoundSet(
  soundSet: SoundSet,
  location?: Location,
  manifest?: Manifest,
): readonly ResolvedEvent[] {
  const trimDbMap = new Map<string, number>();
  if (manifest) {
    for (const sample of manifest.samples) {
      trimDbMap.set(sample.id, sample.trimDb);
    }
  }

  return soundSet.events.map((event: SoundEvent): ResolvedEvent => {
    const component = event.component;
    const modifier = location?.components[component];

    // Determine final sample ID (location sample overrides take precedence)
    const sampleOverride = location?.samples[component];
    const sampleId = sampleOverride && sampleOverride.length > 0 ? sampleOverride : event.sample;

    // Determine sample trim gain
    const trimDb = trimDbMap.get(sampleId) ?? 0;
    const trimGain = dbToLinearGain(trimDb);

    // Multiplicative gain resolution:
    // sampleTrimGain * eventGain * locationGain * locationComponentGain
    const locGain = location?.gain ?? 1;
    const compGain = modifier?.gain ?? 1;
    const effectiveGain = Math.max(0, event.gain * locGain * compGain * trimGain);

    // Filter merging: event filter + location component filter + location global filter
    const effectiveFilter = mergeFilters(event.filter, modifier?.filter, location?.filter);

    if (event.kind === 'transient') {
      const compRate = modifier?.playbackRate ?? 1;
      const effectiveRate = Math.max(0.1, event.playbackRate * compRate);

      return {
        kind: 'transient',
        component,
        sampleId,
        at: event.at,
        gain: effectiveGain,
        playbackRate: effectiveRate,
        ...(effectiveFilter ? { filter: effectiveFilter } : {}),
      };
    }

    return {
      kind: 'murmur',
      component,
      sampleId,
      from: event.from,
      to: event.to,
      shape: event.shape,
      gain: effectiveGain,
      edgeMs: event.edgeMs,
      ...(effectiveFilter ? { filter: effectiveFilter } : {}),
    };
  });
}
