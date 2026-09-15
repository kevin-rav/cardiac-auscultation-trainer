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
