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

export const QuizSchema = z.object({
  id: IdSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(YesNoQuestionSchema).min(1),
});
export type Quiz = z.infer<typeof QuizSchema>;
