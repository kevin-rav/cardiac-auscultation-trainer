import { describe, expect, it } from 'vitest';
import { QuizSchema, QuizSoundSchema, YesNoQuestionSchema } from './quiz';

const validQuestion = {
  id: 's3-present',
  type: 'yes-no',
  prompt: 'Is this an S3 gallop?',
  sound: { soundSet: 's3-gallop', bpm: 72 },
  answer: true,
  explanation: 'S3 falls in early diastole, shortly after S2.',
};

describe('Quiz Schemas', () => {
  describe('QuizSoundSchema', () => {
    it('defaults bpm to 72', () => {
      const parsed = QuizSoundSchema.parse({ soundSet: 'normal-s1-s2' });
      expect(parsed.bpm).toBe(72);
    });

    it('rejects bpm outside 30 to 220', () => {
      expect(QuizSoundSchema.safeParse({ soundSet: 'normal-s1-s2', bpm: 29 }).success).toBe(false);
      expect(QuizSoundSchema.safeParse({ soundSet: 'normal-s1-s2', bpm: 221 }).success).toBe(false);
    });

    it('rejects a sound set id that is not lowercase kebab-case', () => {
      expect(QuizSoundSchema.safeParse({ soundSet: 'S3 Gallop' }).success).toBe(false);
    });
  });

  describe('YesNoQuestionSchema', () => {
    it('accepts a valid question', () => {
      expect(YesNoQuestionSchema.safeParse(validQuestion).success).toBe(true);
    });

    it('accepts a question without an explanation', () => {
      const parsed = YesNoQuestionSchema.safeParse({ ...validQuestion, explanation: undefined });
      expect(parsed.success).toBe(true);
    });

    it('rejects a non-boolean answer', () => {
      expect(YesNoQuestionSchema.safeParse({ ...validQuestion, answer: 'yes' }).success).toBe(
        false,
      );
    });

    it('rejects an empty prompt', () => {
      expect(YesNoQuestionSchema.safeParse({ ...validQuestion, prompt: '' }).success).toBe(false);
    });

    it('rejects other question types', () => {
      expect(
        YesNoQuestionSchema.safeParse({ ...validQuestion, type: 'multiple-choice' }).success,
      ).toBe(false);
    });
  });

  describe('QuizSchema', () => {
    it('accepts a quiz with at least one question', () => {
      const parsed = QuizSchema.safeParse({
        id: 'heart-sounds',
        label: 'Heart Sounds',
        questions: [validQuestion],
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects a quiz with no questions', () => {
      const parsed = QuizSchema.safeParse({
        id: 'heart-sounds',
        label: 'Heart Sounds',
        questions: [],
      });
      expect(parsed.success).toBe(false);
    });
  });
});
