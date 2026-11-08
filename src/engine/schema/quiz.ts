import { z } from 'zod';

const IdSchema = z.string().regex(/^[a-z0-9-]+$/);

/** What the engine plays for a question: a preset sound set at a heart rate. */
export const QuizSoundSchema = z.object({
  soundSet: IdSchema,
  bpm: z.number().min(30).max(220).default(72),
});
export type QuizSound = z.infer<typeof QuizSoundSchema>;

/** "Is this X?" asked about one sound. The learner answers yes or no. */
export const YesNoQuestionSchema = z.object({
  id: IdSchema,
  type: z.literal('yes-no'),
  prompt: z.string().min(1),
  sound: QuizSoundSchema,
  answer: z.boolean(),
  /** Shown after the learner answers, whether they were right or wrong. */
  explanation: z.string().min(1).optional(),
});
export type YesNoQuestion = z.infer<typeof YesNoQuestionSchema>;

export const QuizChoiceSchema = z.object({
  id: IdSchema,
  label: z.string().min(1),
});
export type QuizChoice = z.infer<typeof QuizChoiceSchema>;

/** "Which sound is this?" The learner picks one of the choices. */
export const MultipleChoiceQuestionSchema = z.object({
  id: IdSchema,
  type: z.literal('multiple-choice'),
  prompt: z.string().min(1),
  sound: QuizSoundSchema,
  choices: z.array(QuizChoiceSchema).min(2).max(6),
  /** Id of the correct choice. */
  answer: IdSchema,
  explanation: z.string().min(1).optional(),
});
export type MultipleChoiceQuestion = z.infer<typeof MultipleChoiceQuestionSchema>;

export const QuizQuestionSchema = z.discriminatedUnion('type', [
  YesNoQuestionSchema,
  MultipleChoiceQuestionSchema,
]);
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizSchema = z.object({
  id: IdSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(QuizQuestionSchema).min(1),
});
export type Quiz = z.infer<typeof QuizSchema>;

/** A learner's answer: true or false for yes-no, or a choice id for multiple choice. */
export type QuizAnswer = boolean | string;
