import locationsJson from './locations.json';
import manifestJson from './manifest.json';
import spatialJson from './spatial.json';
import {
  LocationsSchema,
  ManifestSchema,
  QuizSchema,
  SoundSetSchema,
  SpatialConfigSchema,
  type Location,
  type LocationId,
  type Manifest,
  type Quiz,
  type SoundSet,
  type SpatialConfig,
} from '../engine/schema';

export const manifest: Manifest = ManifestSchema.parse(manifestJson);

export const PRESET_LOCATIONS: readonly Location[] = LocationsSchema.parse(locationsJson);

export const locationsRecord: Readonly<Record<LocationId, Location>> = Object.fromEntries(
  PRESET_LOCATIONS.map((loc) => [loc.id, loc]),
) as Record<LocationId, Location>;

export const spatialConfig: SpatialConfig = SpatialConfigSchema.parse(spatialJson);

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

/** Ids a quiz question may reference, for validateQuiz. */
export const SOUND_SET_IDS: ReadonlySet<string> = new Set(Object.keys(soundSetsRecord));

const quizFiles = import.meta.glob<Record<string, unknown>>('./quizzes/*.json', {
  eager: true,
  import: 'default',
});

export const PRESET_QUIZZES: readonly Quiz[] = Object.values(quizFiles).map((data) =>
  QuizSchema.parse(data),
);

export const quizzesRecord: Readonly<Record<string, Quiz>> = Object.fromEntries(
  PRESET_QUIZZES.map((quiz) => [quiz.id, quiz]),
);
