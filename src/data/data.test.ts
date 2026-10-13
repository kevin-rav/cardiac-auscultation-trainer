import { describe, expect, it } from 'vitest';
import { ManifestSchema, SoundSetSchema } from '../engine/schema';
import { manifest, PRESET_SOUND_SETS, soundSetsRecord } from './index';

describe('Data files schema validation', () => {
  it('validates manifest against ManifestSchema', () => {
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
    expect(manifest.samples.length).toBeGreaterThanOrEqual(6);
  });

  it('validates all preset sound sets against SoundSetSchema', () => {
    expect(PRESET_SOUND_SETS.length).toBeGreaterThanOrEqual(7);

    for (const soundSet of PRESET_SOUND_SETS) {
      const result = SoundSetSchema.safeParse(soundSet);
      expect(result.success, `Failed validating soundSet: ${soundSet.id}`).toBe(true);
      expect(soundSet.events.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('contains expected clinical sound sets in soundSetsRecord', () => {
    expect(soundSetsRecord['normal-s1-s2']).toBeDefined();
    expect(soundSetsRecord['s3-gallop']).toBeDefined();
    expect(soundSetsRecord['s4-gallop']).toBeDefined();
    expect(soundSetsRecord['mid-systolic-click']).toBeDefined();
    expect(soundSetsRecord['mvp-late-systolic-murmur']).toBeDefined();
    expect(soundSetsRecord['aortic-stenosis']).toBeDefined();
    expect(soundSetsRecord['mitral-regurgitation']).toBeDefined();
  });

  it('ensures all preset sound sets reference existing manifest samples with non-empty URLs', () => {
    const validSamples = new Map(manifest.samples.map((s) => [s.id, s.url]));

    for (const soundSet of PRESET_SOUND_SETS) {
      for (const event of soundSet.events) {
        const sampleUrl = validSamples.get(event.sample);
        expect(
          sampleUrl,
          `Sound set "${soundSet.id}" references sampleId "${event.sample}" which is missing from manifest.json`,
        ).toBeDefined();
        expect(
          sampleUrl?.length,
          `Manifest sample "${event.sample}" has an empty URL`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
