import locationsJson from './locations.json';
import manifestJson from './manifest.json';
import {
  LocationsSchema,
  ManifestSchema,
  SoundSetSchema,
  type Location,
  type LocationId,
  type Manifest,
  type SoundSet,
} from '../engine/schema';

export const manifest: Manifest = ManifestSchema.parse(manifestJson);

export const PRESET_LOCATIONS: readonly Location[] = LocationsSchema.parse(locationsJson);

export const locationsRecord: Readonly<Record<LocationId, Location>> = Object.fromEntries(
  PRESET_LOCATIONS.map((loc) => [loc.id, loc]),
) as Record<LocationId, Location>;

const soundSetFiles = import.meta.glob<Record<string, unknown>>('./sound-sets/*.json', {
  eager: true,
  import: 'default',
});

export const PRESET_SOUND_SETS: readonly SoundSet[] = Object.values(soundSetFiles).map((data) =>
  SoundSetSchema.parse(data),
);

export const soundSetsRecord: Readonly<Record<string, SoundSet>> = Object.fromEntries(
  PRESET_SOUND_SETS.map((set) => [set.id, set]),
);
