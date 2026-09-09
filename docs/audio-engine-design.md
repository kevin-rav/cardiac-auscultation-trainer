# Audio Engine Design

Status: draft for review. Covers the config-driven Web Audio engine only. The
Three.js scene, EKG display, and visual design are out of scope and will get
their own docs.

## 1. Goals

- Sample-accurate playback scheduled on the AudioContext clock, independent of
  frame rate and tab visibility.
- Every heart sound defined as data, validated against a schema, with no code
  change needed to add or tune one.
- A physiological model of the cardiac cycle so timing scales correctly with
  heart rate.
- Irregular rhythms. Atrial fibrillation, dropped beats, and rate ramps must be
  expressible.
- A pure scheduling core that runs under Vitest in Node with no DOM and no Web
  Audio.
- Clean control over live audio: pause, volume, and scenario changes take
  effect immediately without overlap or ringing.

Non-goals for the first version: respiratory variation of S2 splitting, lung
sounds, spatial audio, and recording.

## 2. Vocabulary

The old codebase used "rhythm" for everything. This design separates four
ideas that the schema keeps apart.

| Term          | Meaning                                                                           |
| ------------- | --------------------------------------------------------------------------------- |
| **Sample**    | One audio file: a recorded S1, a murmur loop, a click.                            |
| **Sound set** | Which sounds occur in one cardiac cycle and where. "Normal S1 S2", "S3 gallop".   |
| **Rhythm**    | How beats are spaced over time. Regular sinus, atrial fibrillation, 2:1 block.    |
| **Location**  | An auscultation site and how it colors each component. Aortic, pulmonic, etc.     |
| **Scenario**  | A named combination of sound set, rhythm, BPM, and location. What the user picks. |

## 3. Module layout

```
src/
├── engine/             pure logic, no DOM, no Web Audio
│   ├── schema/         zod schemas and inferred types
│   ├── cycle.ts        RR interval to systole/diastole landmarks
│   ├── beats.ts        rhythm generators that yield beats
│   ├── envelope.ts     murmur shape to gain curve
│   ├── resolve.ts      sound set + location to per-cycle events
│   └── scheduler.ts    beats + events + time window to scheduled events
├── audio/              the only code that touches Web Audio
│   ├── context.ts      create and resume on first gesture
│   ├── loader.ts       preload manifest into AudioBuffers
│   ├── graph.ts        master gain, compressor, destination
│   └── player.ts       lookahead loop, voice tracking
├── data/               JSON config, validated at import
│   ├── manifest.json
│   ├── sound-sets/*.json
│   ├── rhythms/*.json
│   ├── locations.json
│   └── scenarios/*.json
├── store/              Zustand store: app state and the actions that change it
├── components/         React components
├── App.tsx             root component
└── main.tsx            mounts App into index.html
```

Dependency direction is one way:

```
data → engine → audio → store → components → App → main
```

`engine/` imports nothing from the layers to its right. Components never
import `audio/` or `engine/` directly. They read state and call actions on the
store, and the store drives the player.

## 4. The cardiac cycle model

Everything is positioned relative to landmarks in one beat, not to fractions
of an arbitrary loop. For a beat with RR interval `rr` milliseconds:

| Landmark   | Definition                                   |
| ---------- | -------------------------------------------- |
| `S1`       | Start of the beat. Time 0.                   |
| `S2`       | End of mechanical systole. `S1 + systoleMs`. |
| `nextS1`   | Start of the following beat. `S1 + rr`.      |
| `systole`  | Interval `[S1, S2]`.                         |
| `diastole` | Interval `[S2, nextS1]`.                     |

Systole duration comes from heart rate. The default uses Weissler's regression
for electromechanical systole, which is close to the S1-to-S2 interval:

```
systoleMs = clamp(546 - 2.1 * bpm, 200, 450)
```

At 60 BPM that gives 420 ms of systole and 580 ms of diastole. At 150 BPM it
gives 231 ms of systole and 169 ms of diastole, which is why S3 and S4 merge
into a summation gallop at high rates in real patients. The formula's
coefficients live in `data/cycle.json` so a subject-matter expert can tune them
without touching code.

A **Position** is a landmark plus an offset. The offset is either absolute
milliseconds or a fraction of the interval that starts at the landmark:

```jsonc
{ "anchor": "S1" }                          // exactly at S1
{ "anchor": "S2", "ms": 140 }               // S3: early diastole
{ "anchor": "nextS1", "ms": -90 }           // S4: presystolic
{ "anchor": "S1", "fraction": 0.5 }         // mid-systolic click
{ "anchor": "S2", "fraction": 0.1 }         // 10% into diastole
```

`fraction` on `S1` is a fraction of systole. `fraction` on `S2` is a fraction
of diastole. `fraction` on `nextS1` is not allowed.

## 5. Schemas

Schemas are defined once in zod under `src/engine/schema/` and the TypeScript
types are inferred from them. A build step can emit JSON Schema from the same
definitions for editor autocomplete on the JSON files. Every file under
`src/data/` is parsed at import time, and a test loads all of them so an
invalid file fails CI.

### 5.1 Sample manifest

Maps a stable sample id to a file in `public/sounds/`. `kind` tells the player
whether the sample is a one-shot or a loop that needs an envelope.

```ts
const Sample = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  url: z.string().startsWith('/sounds/'),
  kind: z.enum(['transient', 'sustained']),
  /** Gain trim in dB applied to every use of this sample, for level matching. */
  trimDb: z.number().default(0),
  source: z.string().optional(),
  license: z.string().optional(),
});

const Manifest = z.object({
  samples: z.array(Sample),
});
```

```json
{
  "samples": [
    { "id": "s1-apex", "url": "/sounds/s1-apex.wav", "kind": "transient", "source": "UMich" },
    { "id": "s2-base", "url": "/sounds/s2-base.wav", "kind": "transient", "source": "UMich" },
    { "id": "s3", "url": "/sounds/s3.wav", "kind": "transient", "trimDb": 3 },
    { "id": "murmur-noise", "url": "/sounds/murmur-noise.wav", "kind": "sustained" }
  ]
}
```

### 5.2 Sound set

The sounds in one cardiac cycle. Each event is a **component** with a role, so
locations can attenuate "S3" without knowing which sample plays it.

```ts
const Landmark = z.enum(['S1', 'S2', 'nextS1']);

const Position = z
  .object({
    anchor: Landmark,
    ms: z.number().optional(),
    fraction: z.number().min(0).max(1).optional(),
  })
  .refine((p) => !(p.ms !== undefined && p.fraction !== undefined), 'ms and fraction are exclusive')
  .refine((p) => !(p.anchor === 'nextS1' && p.fraction !== undefined), 'nextS1 has no fraction');

const Component = z.enum([
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

const Filter = z.object({
  highpassHz: z.number().min(20).max(2000).optional(),
  lowpassHz: z.number().min(200).max(20000).optional(),
});

const Transient = z.object({
  kind: z.literal('transient'),
  component: Component,
  sample: z.string(),
  at: Position,
  gain: z.number().min(0).max(4).default(1),
  playbackRate: z.number().min(0.5).max(2).default(1),
  filter: Filter.optional(),
});

const Murmur = z.object({
  kind: z.literal('murmur'),
  component: Component,
  sample: z.string(),
  from: Position,
  to: Position,
  shape: z.enum(['plateau', 'crescendo', 'decrescendo', 'diamond']),
  gain: z.number().min(0).max(4).default(1),
  filter: Filter.optional(),
  /** Attack and release in ms so the loop never clicks at the edges. */
  edgeMs: z.number().min(0).max(100).default(15),
});

const SoundEvent = z.discriminatedUnion('kind', [Transient, Murmur]);

const SoundSet = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string(),
  description: z.string().optional(),
  events: z.array(SoundEvent).min(1),
});
```

Normal heart sounds:

```json
{
  "id": "normal",
  "label": "Normal S1 S2",
  "events": [
    { "kind": "transient", "component": "S1", "sample": "s1-apex", "at": { "anchor": "S1" } },
    { "kind": "transient", "component": "S2", "sample": "s2-base", "at": { "anchor": "S2" } }
  ]
}
```

Mitral valve prolapse with a mid-systolic click and late systolic murmur:

```json
{
  "id": "mvp-click-late-murmur",
  "label": "Mid-systolic click with late systolic murmur",
  "description": "Mitral valve prolapse with mitral regurgitation",
  "events": [
    { "kind": "transient", "component": "S1", "sample": "s1-apex", "at": { "anchor": "S1" } },
    {
      "kind": "transient",
      "component": "click",
      "sample": "click",
      "at": { "anchor": "S1", "fraction": 0.5 }
    },
    {
      "kind": "murmur",
      "component": "systolicMurmur",
      "sample": "murmur-noise",
      "from": { "anchor": "S1", "fraction": 0.55 },
      "to": { "anchor": "S2" },
      "shape": "crescendo",
      "gain": 0.8,
      "filter": { "highpassHz": 200, "lowpassHz": 3000 }
    },
    { "kind": "transient", "component": "S2", "sample": "s2-base", "at": { "anchor": "S2" } }
  ]
}
```

Fixed split S2, as in atrial septal defect. A split is two transients, not a
special case:

```json
{
  "id": "s2-fixed-split",
  "label": "Fixed split S2",
  "events": [
    { "kind": "transient", "component": "S1", "sample": "s1-apex", "at": { "anchor": "S1" } },
    { "kind": "transient", "component": "S2", "sample": "a2", "at": { "anchor": "S2" } },
    { "kind": "transient", "component": "S2", "sample": "p2", "at": { "anchor": "S2", "ms": 50 } }
  ]
}
```

Because positions use landmarks, the murmur above always ends exactly at S2
whether the heart is at 50 or 160 BPM. The old engine's fixed-seconds envelopes
could not do this.

### 5.3 Rhythm

A rhythm is a beat generator. It answers one question: given the previous
beat, when is the next one and what happened to it? The generator is a
discriminated union so new rhythm types are added by adding a variant.

```ts
const Rhythm = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('regular'),
    id: z.string(),
    label: z.string(),
  }),
  z.object({
    type: z.literal('irregular'),
    id: z.string(),
    label: z.string(),
    /** Coefficient of variation of the RR interval. AFib is around 0.2 to 0.3. */
    variability: z.number().min(0).max(1),
    /** Irregularly irregular rhythms have no atrial kick, so no S4. */
    atrialKick: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('blocked'),
    id: z.string(),
    label: z.string(),
    /** Every nth P wave is not conducted, producing a silent gap. 2 means 2:1. */
    conductEvery: z.number().int().min(2),
  }),
  z.object({
    type: z.literal('ramp'),
    id: z.string(),
    label: z.string(),
    toBpm: z.number().min(30).max(220),
    seconds: z.number().min(1),
  }),
]);
```

```json
{ "type": "regular", "id": "sinus", "label": "Normal sinus rhythm" }
```

```json
{ "type": "irregular", "id": "afib", "label": "Atrial fibrillation", "variability": 0.25 }
```

```json
{ "type": "blocked", "id": "av-block-2-1", "label": "2:1 AV block", "conductEvery": 2 }
```

```json
{ "type": "ramp", "id": "exercise", "label": "Exercise", "toBpm": 140, "seconds": 30 }
```

Each generator yields **Beat** objects:

```ts
type Beat = {
  index: number;
  /** Start time on the audio clock, seconds. */
  start: number;
  /** Interval to the next beat, ms. */
  rr: number;
  /** False for a non-conducted beat: no ventricular sounds, only the gap. */
  conducted: boolean;
  /** False when there is no effective atrial contraction. Suppresses S4. */
  atrialKick: boolean;
};
```

Generators take a seedable random source so tests are deterministic. Beat
generation is lazy. The scheduler pulls beats only as far ahead as the
lookahead window needs.

### 5.4 Location

An auscultation site. It multiplies the gain of each component and can apply
a filter to everything heard there. Per-component values are multipliers, not
replacements. A missing component means 1.

```ts
const ComponentModifier = z.object({
  gain: z.number().min(0).max(4).default(1),
  playbackRate: z.number().min(0.5).max(2).default(1),
  filter: Filter.optional(),
});

const Location = z.object({
  id: z.enum(['aortic', 'pulmonic', 'tricuspid', 'mitral']),
  label: z.string(),
  /** Anatomical landmark, shown in the UI. */
  landmark: z.string(),
  gain: z.number().min(0).max(2).default(1),
  filter: Filter.optional(),
  components: z.partialRecord(Component, ComponentModifier).default({}),
  /** Swap the sample used for a component at this site, e.g. a base-recorded S2. */
  samples: z.partialRecord(Component, z.string()).default({}),
});

const Locations = z.array(Location).length(4);
```

```json
{
  "id": "pulmonic",
  "label": "Pulmonic",
  "landmark": "2nd intercostal space, left sternal border",
  "filter": { "highpassHz": 80 },
  "components": {
    "S1": { "gain": 0.6 },
    "S2": { "gain": 1.2, "playbackRate": 1.05 },
    "S3": { "gain": 0.4 },
    "S4": { "gain": 0.4 },
    "click": { "gain": 0.2 },
    "systolicMurmur": { "gain": 0.8 }
  },
  "samples": { "S2": "s2-base" }
}
```

This is where the SME request for a "clearer, slightly higher pitched"
pulmonic site with S2 louder than S1 lives, as data.

### 5.5 Scenario

What the user selects in the dropdown. It binds the other four together and
carries UI metadata.

```ts
const Scenario = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string(),
  description: z.string().optional(),
  soundSet: z.string(),
  rhythm: z.string(),
  bpm: z.number().min(30).max(220),
  /** Site the scenario is best heard at. The user can still change it. */
  defaultLocation: Location.shape.id,
  /** "core" appears in the main list. "extended" goes under Show more. */
  tier: z.enum(['core', 'extended']).default('extended'),
  tags: z.array(z.string()).default([]),
});
```

```json
{
  "id": "afib",
  "label": "Atrial fibrillation",
  "description": "Irregularly irregular rhythm with no S4",
  "soundSet": "normal",
  "rhythm": "afib",
  "bpm": 110,
  "defaultLocation": "mitral",
  "tier": "core"
}
```

A validation pass checks that every `soundSet`, `rhythm`, and `sample`
reference resolves. Dangling ids fail the data test.

### 5.6 Cycle parameters

```ts
const CycleParams = z.object({
  systole: z.object({
    interceptMs: z.number().default(546),
    slopePerBpm: z.number().default(2.1),
    minMs: z.number().default(200),
    maxMs: z.number().default(450),
  }),
});
```

## 6. Engine pipeline

The engine is a chain of pure functions.

```
cycle.ts     landmarks(rr, params)            → { S1: 0, S2: systoleMs, nextS1: rr }
resolve.ts   resolve(soundSet, location, manifest)
                                              → ResolvedEvent[]   (gains and samples merged, once per scenario change)
beats.ts     generator(rhythm, bpm, rng)      → Iterator<Beat>
envelope.ts  curve(shape, durationMs, edgeMs) → [timeMs, gain][]
scheduler.ts schedule(beats, resolved, from, to)
                                              → ScheduledEvent[]
```

A **ScheduledEvent** is everything the player needs and nothing it has to
compute:

```ts
type ScheduledEvent = {
  sampleId: string;
  /** Absolute audio-clock time in seconds. */
  time: number;
  gain: number;
  playbackRate: number;
  filter?: { highpassHz?: number; lowpassHz?: number };
  /** Present for sustained samples. Loop until stop, shaped by the curve. */
  envelope?: { durationMs: number; curve: [number, number][] };
};
```

Resolution order for gain is multiplicative at every layer:

```
sample.trimDb → event.gain → location.gain → location.components[c].gain → master
```

Beat flags gate events. A non-conducted beat schedules nothing. A beat without
atrial kick drops any event whose component is `S4`.

## 7. Player

`player.ts` is the only consumer of `ScheduledEvent` and the only code that
creates AudioNodes.

**Clock.** A lookahead scheduler in the pattern of Chris Wilson's "A Tale of
Two Clocks." A `setInterval` fires every 25 ms and schedules every event whose
time falls within the next 100 ms using `source.start(time)`. The interval
timer only has to be roughly on time. The audio clock is exact.

**Graph.**

```
voice: source → [filter] → gain ─┐
voice: source → [filter] → gain ─┼→ master gain → compressor → destination
voice: source → [filter] → gain ─┘
```

The compressor is a safety limiter so template gains above 1 can't clip. The
master gain is the volume control and changes affect sound already playing.

**Voices.** Every started source is tracked in a set with its scheduled stop
time. `stopAll(atTime)` ramps each voice's gain to zero over 10 ms and stops
it. This is what makes pause, scenario change, and location change clean.

**Envelopes** are applied with `setValueCurveAtTime` from the curve array,
already scaled to the beat's actual duration by the scheduler.

**State changes.**

| Change          | Behavior                                                        |
| --------------- | --------------------------------------------------------------- |
| Play            | Resume context if suspended. Start the beat generator at `now`. |
| Pause           | `stopAll`. Remember phase within the current beat.              |
| Resume          | Continue from the remembered phase, not from S1.                |
| BPM change      | Applies to the next beat. No phase reset.                       |
| Location change | Re-resolve events. Takes effect at the next beat.               |
| Scenario change | `stopAll`, re-resolve, restart at the next beat boundary.       |
| Volume change   | Ramp master gain over 20 ms.                                    |

**Loading.** All samples in the manifest are fetched and decoded before the
play button enables. No lazy loading, so the first beat is never late.

**Autoplay policy.** The context is created at startup and resumed on the first
pointer or key event. The play button is disabled until both loading and
resume have succeeded.

## 8. State and actions

App state lives in one Zustand store under `store/`. The store holds the
values the UI renders and the actions that change them.

```ts
type AppState = {
  status: 'loading' | 'ready' | 'playing' | 'paused' | 'error';
  scenarioId: string;
  locationId: Location['id'];
  bpm: number;
  volume: number;
  error?: string;
};

type AppActions = {
  play: () => void;
  pause: () => void;
  selectScenario: (id: string) => void;
  selectLocation: (id: Location['id']) => void;
  setBpm: (bpm: number) => void;
  setVolume: (volume: number) => void;
};
```

Each action validates its input, updates state, and calls the player. The
player is created once at startup and handed to the store. Components
subscribe to the slices they render with the `useAppStore` hook and call
actions from event handlers. No component touches the player, `audio/`, or
`engine/`.

Static data such as scenarios and sound sets is not in the store. It is
imported from `data/` and never changes while the app runs.

## 9. Testing

All engine tests run in Node with no browser APIs.

- **Schema tests** load every file in `src/data/` and assert it parses. A
  second pass checks cross-references.
- **Cycle tests** pin the systole formula at a few heart rates and the clamps.
- **Beat generator tests** use a fixed seed. Regular yields exact intervals.
  Irregular has the requested coefficient of variation over 1000 beats. Blocked
  drops the right beats. Ramp reaches the target BPM at the right time.
- **Scheduler tests** are the important ones. Given a scenario and a window,
  assert the exact list of events. Assert a murmur ends at S2 at both 60 and
  150 BPM. Assert no S4 in AFib. Assert nothing is scheduled during a blocked
  beat. Assert a window straddling a beat boundary returns events from both
  beats and none twice.
- **Store tests** render nothing. They call actions and assert state and
  player calls using a fake player.
- **Player tests** use a fake AudioContext that records `start` calls. They
  assert that events are started at their scheduled times and that `stopAll`
  stops every tracked voice.

## 10. Migration from the old repo

- Keep the 8 WAV component samples. Rename to manifest ids and move to
  `public/sounds/`. Record their source in the manifest.
- Drop the 89 unreferenced MP3s from the repo. Keep the links file in the docs
  folder as a catalog for possible future samples.
- Port the six original sound sets first, then the SME core list as scenarios:
  normal sinus, AFib, first degree block, second degree block, third degree
  block, SVT, VT, VFib, asystole. The last four need only a sound set and a
  rhythm variant each. Third degree block, VT, VFib, and asystole are noted as
  open questions below.
- Do not port the "isNew" templates whose timings were clinically wrong. Rebuild
  those from landmarks once the pipeline works.

## 11. Open questions

1. **Third degree block, VT, VFib, asystole.** These are EKG rhythms more than
   sound patterns. Asystole is trivially a silent generator. VFib has no
   effective beats and is effectively silence at the chest. VT is a regular fast
   rhythm with soft, variable S1. Third degree block is a slow regular
   ventricular rhythm with variable S1 intensity. Proposal: add an
   `s1Variability` field to the regular generator and a `silent` variant, and
   confirm with the SME.
2. **Murmur source material.** One noise loop shaped by filters and envelopes
   versus a recorded murmur per type. Filters plus envelope are more flexible
   and consistent across locations. Recorded murmurs sound more real. Start
   with the shaped loop and evaluate with the SME.
3. **Respiratory variation** of physiologic S2 splitting. Needs a slow
   modulator at roughly 0.25 Hz feeding the P2 offset. Cheap to add later since
   the scheduler already computes offsets per beat.
4. **Data in `src/` versus fetched at runtime.** Decided: `src/data/`, so the
   schema test runs in CI. Revisit only if non-developers need to edit
   scenarios without a rebuild.
