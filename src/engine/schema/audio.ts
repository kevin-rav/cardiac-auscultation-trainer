import { z } from 'zod';

export const LandmarkSchema = z.enum(['S1', 'S2', 'nextS1']);
export type Landmark = z.infer<typeof LandmarkSchema>;

export const PositionSchema = z
  .object({
    anchor: LandmarkSchema,
    ms: z.number().optional(),
    fraction: z.number().min(0).max(1).optional(),
  })
  .refine(
    (p) => !(p.ms !== undefined && p.fraction !== undefined),
    'ms and fraction are mutually exclusive',
  )
  .refine(
    (p) => !(p.anchor === 'nextS1' && p.fraction !== undefined),
    'nextS1 cannot use fraction',
  );
export type Position = z.infer<typeof PositionSchema>;

export const ComponentSchema = z.enum([
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
]);
export type Component = z.infer<typeof ComponentSchema>;

export const FilterSchema = z.object({
  highpassHz: z.number().min(20).max(2000).optional(),
  lowpassHz: z.number().min(200).max(20000).optional(),
});
export type Filter = z.infer<typeof FilterSchema>;

export const TransientSchema = z.object({
  kind: z.literal('transient'),
  component: ComponentSchema,
  sample: z.string().min(1),
  at: PositionSchema,
  gain: z.number().min(0).max(4).default(1),
  playbackRate: z.number().min(0.5).max(2).default(1),
  filter: FilterSchema.optional(),
});
export type Transient = z.infer<typeof TransientSchema>;

export const MurmurShapeSchema = z.enum(['plateau', 'crescendo', 'decrescendo', 'diamond']);
export type MurmurShape = z.infer<typeof MurmurShapeSchema>;

export const MurmurSchema = z.object({
  kind: z.literal('murmur'),
  component: ComponentSchema,
  sample: z.string().min(1),
  from: PositionSchema,
  to: PositionSchema,
  shape: MurmurShapeSchema,
  gain: z.number().min(0).max(4).default(1),
  filter: FilterSchema.optional(),
  edgeMs: z.number().min(0).max(100).default(15),
});
export type Murmur = z.infer<typeof MurmurSchema>;

export const SoundEventSchema = z.discriminatedUnion('kind', [TransientSchema, MurmurSchema]);
export type SoundEvent = z.infer<typeof SoundEventSchema>;

export const SoundSetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  description: z.string().optional(),
  events: z.array(SoundEventSchema).min(1),
});
export type SoundSet = z.infer<typeof SoundSetSchema>;

export const SampleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  url: z.string().startsWith('/sounds/'),
  kind: z.enum(['transient', 'sustained']),
  trimDb: z.number().default(0),
  source: z.string().optional(),
  license: z.string().optional(),
});
export type Sample = z.infer<typeof SampleSchema>;

export const ManifestSchema = z.object({
  samples: z.array(SampleSchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const RhythmRegularSchema = z.object({
  type: z.literal('regular'),
  id: z.string(),
  label: z.string(),
});
export type RhythmRegular = z.infer<typeof RhythmRegularSchema>;

export const RhythmIrregularSchema = z.object({
  type: z.literal('irregular'),
  id: z.string(),
  label: z.string(),
  variability: z.number().min(0).max(1),
  atrialKick: z.boolean().default(false),
});
export type RhythmIrregular = z.infer<typeof RhythmIrregularSchema>;

export const RhythmBlockedSchema = z.object({
  type: z.literal('blocked'),
  id: z.string(),
  label: z.string(),
  conductEvery: z.number().int().min(2),
});
export type RhythmBlocked = z.infer<typeof RhythmBlockedSchema>;

export const RhythmRampSchema = z.object({
  type: z.literal('ramp'),
  id: z.string(),
  label: z.string(),
  toBpm: z.number().min(30).max(220),
  seconds: z.number().min(1),
});
export type RhythmRamp = z.infer<typeof RhythmRampSchema>;

export const RhythmSchema = z.discriminatedUnion('type', [
  RhythmRegularSchema,
  RhythmIrregularSchema,
  RhythmBlockedSchema,
  RhythmRampSchema,
]);
export type Rhythm = z.infer<typeof RhythmSchema>;

export const ComponentModifierSchema = z.object({
  gain: z.number().min(0).max(4).default(1),
  playbackRate: z.number().min(0.5).max(2).default(1),
  filter: FilterSchema.optional(),
});
export type ComponentModifier = z.infer<typeof ComponentModifierSchema>;

export const LocationIdSchema = z.enum(['aortic', 'pulmonic', 'tricuspid', 'mitral']);
export type LocationId = z.infer<typeof LocationIdSchema>;

export const LocationSchema = z.object({
  id: LocationIdSchema,
  label: z.string(),
  landmark: z.string(),
  gain: z.number().min(0).max(2).default(1),
  filter: FilterSchema.optional(),
  components: z.record(z.string(), ComponentModifierSchema).default({}),
  samples: z.record(z.string(), z.string()).default({}),
});
export type Location = z.infer<typeof LocationSchema>;

export const CycleParamsSchema = z.object({
  systole: z.object({
    interceptMs: z.number().default(546),
    slopePerBpm: z.number().default(2.1),
    minMs: z.number().default(200),
    maxMs: z.number().default(450),
  }),
});
export type CycleParams = z.infer<typeof CycleParamsSchema>;
