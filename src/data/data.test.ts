import { describe, expect, it } from 'vitest';
import { ManifestSchema, QuizSchema, SoundSetSchema } from '../engine/schema';
import { manifest, PRESET_QUIZZES, PRESET_SOUND_SETS, soundSetsRecord } from './index';

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

describe('Quiz data files', () => {
  it('loads at least one quiz and validates each against QuizSchema', () => {
    expect(PRESET_QUIZZES.length).toBeGreaterThanOrEqual(1);

    for (const quiz of PRESET_QUIZZES) {
      const result = QuizSchema.safeParse(quiz);
      expect(result.success, `Failed validating quiz: ${quiz.id}`).toBe(true);
    }
  });

  it('gives every quiz a unique id', () => {
    const ids = PRESET_QUIZZES.map((quiz) => quiz.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every question a unique id within its quiz', () => {
    for (const quiz of PRESET_QUIZZES) {
      const ids = quiz.questions.map((question) => question.id);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      expect(duplicates, `Quiz "${quiz.id}" has duplicate question ids`).toEqual([]);
    }
  });

  it('only references sound sets that exist', () => {
    for (const quiz of PRESET_QUIZZES) {
      for (const question of quiz.questions) {
        expect(
          soundSetsRecord[question.sound.soundSet],
          `Quiz "${quiz.id}" question "${question.id}" references missing sound set "${question.sound.soundSet}"`,
        ).toBeDefined();
      }
    }
  });

  it('includes both yes and no answers in every quiz', () => {
    // A quiz with one answer throughout can be passed without listening.
    for (const quiz of PRESET_QUIZZES) {
      const answers = new Set(quiz.questions.map((question) => question.answer));
      expect(answers, `Quiz "${quiz.id}" needs both yes and no answers`).toEqual(
        new Set([true, false]),
      );
    }
  });
});
