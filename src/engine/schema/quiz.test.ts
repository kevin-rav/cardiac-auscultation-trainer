import { describe, expect, it } from 'vitest';
import {
  MultipleChoiceQuestionSchema,
  QuizSchema,
  QuizSoundSchema,
  YesNoQuestionSchema,
} from './quiz';

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

  describe('MultipleChoiceQuestionSchema', () => {
    const mcq = {
      id: 'name-the-gallop',
      type: 'multiple-choice',
      prompt: 'Which sound is this?',
      sound: { soundSet: 's3-gallop' },
      choices: [
        { id: 's3', label: 'S3 gallop' },
        { id: 's4', label: 'S4 gallop' },
      ],
      answer: 's3',
    };

    it('accepts a valid multiple-choice question', () => {
      expect(MultipleChoiceQuestionSchema.safeParse(mcq).success).toBe(true);
    });

    it('rejects fewer than 2 or more than 6 choices', () => {
      const choice = { id: 'c', label: 'Choice' };
      expect(MultipleChoiceQuestionSchema.safeParse({ ...mcq, choices: [choice] }).success).toBe(
        false,
      );
      const seven = Array.from({ length: 7 }, (_, i) => ({ id: `c${String(i)}`, label: 'C' }));
      expect(MultipleChoiceQuestionSchema.safeParse({ ...mcq, choices: seven }).success).toBe(
        false,
      );
    });

    it('rejects an empty choice label', () => {
      const choices = [
        { id: 's3', label: '' },
        { id: 's4', label: 'S4 gallop' },
      ];
      expect(MultipleChoiceQuestionSchema.safeParse({ ...mcq, choices }).success).toBe(false);
    });

    it('lets a quiz mix yes-no and multiple-choice questions', () => {
      const parsed = QuizSchema.safeParse({
        id: 'mixed',
        label: 'Mixed',
        questions: [validQuestion, mcq],
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects an unknown question type in a quiz', () => {
      const parsed = QuizSchema.safeParse({
        id: 'mixed',
        label: 'Mixed',
        questions: [{ ...validQuestion, type: 'free-text' }],
      });
      expect(parsed.success).toBe(false);
    });
  });
});
