import manifestJson from './manifest.json';
import normalJson from './sound-sets/normal-s1-s2.json';
import s3GallopJson from './sound-sets/s3-gallop.json';
import s4GallopJson from './sound-sets/s4-gallop.json';
import midSystolicClickJson from './sound-sets/mid-systolic-click.json';
import mvpLateMurmurJson from './sound-sets/mvp-late-systolic-murmur.json';
import aorticStenosisJson from './sound-sets/aortic-stenosis.json';
import mitralRegurgitationJson from './sound-sets/mitral-regurgitation.json';
import { ManifestSchema, SoundSetSchema, type Manifest, type SoundSet } from '../engine/schema';

export const manifest: Manifest = ManifestSchema.parse(manifestJson);

export const PRESET_SOUND_SETS: readonly SoundSet[] = [
  SoundSetSchema.parse(normalJson),
  SoundSetSchema.parse(s3GallopJson),
  SoundSetSchema.parse(s4GallopJson),
  SoundSetSchema.parse(midSystolicClickJson),
  SoundSetSchema.parse(mvpLateMurmurJson),
  SoundSetSchema.parse(aorticStenosisJson),
  SoundSetSchema.parse(mitralRegurgitationJson),
];

export const soundSetsRecord: Readonly<Record<string, SoundSet>> = Object.fromEntries(
  PRESET_SOUND_SETS.map((set) => [set.id, set]),
);
