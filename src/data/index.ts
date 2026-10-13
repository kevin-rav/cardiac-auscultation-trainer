import manifestJson from './manifest.json';
import { ManifestSchema, SoundSetSchema, type Manifest, type SoundSet } from '../engine/schema';

export const manifest: Manifest = ManifestSchema.parse(manifestJson);

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
