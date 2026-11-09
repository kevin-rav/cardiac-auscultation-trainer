import { z } from 'zod';
import type { Quiz, QuizSchema } from '../engine/schema';
import { parseQuizFile } from './parseQuizFile';

/**
 * A quiz while it is being written in the builder. It mirrors the quiz file
 * format but has no ids: those are generated on export, so authors never type
 * them. `key` only identifies a question or choice inside the builder.
 */
const DraftChoiceSchema = z.object({ key: z.string(), label: z.string() });

const DraftQuestionBase = {
  key: z.string(),
  prompt: z.string(),
  soundSet: z.string(),
  bpm: z.number(),
  explanation: z.string(),
};

export const DraftQuestionSchema = z.discriminatedUnion('type', [
  z.object({ ...DraftQuestionBase, type: z.literal('yes-no'), answer: z.boolean() }),
  z.object({
    ...DraftQuestionBase,
    type: z.literal('multiple-choice'),
    choices: z.array(DraftChoiceSchema),
    /** Key of the correct choice. */
    answerKey: z.string(),
  }),
]);

export const QuizDraftSchema = z.object({
  label: z.string(),
  description: z.string(),
  questions: z.array(DraftQuestionSchema),
});

export type DraftChoice = z.infer<typeof DraftChoiceSchema>;
export type DraftQuestion = z.infer<typeof DraftQuestionSchema>;
export type QuizDraft = z.infer<typeof QuizDraftSchema>;

/** Lowercase kebab-case, the format quiz ids use. Empty if nothing usable remains. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Build the quiz file object from a draft, generating every id. */
export function draftToQuiz(draft: QuizDraft): z.input<typeof QuizSchema> {
  return {
    id: slugify(draft.label) || 'untitled-quiz',
    label: draft.label,
    ...(draft.description.trim() === '' ? {} : { description: draft.description }),
    questions: draft.questions.map((q, index) => {
      const common = {
        id: `q${String(index + 1)}`,
        prompt: q.prompt,
        sound: { soundSet: q.soundSet, bpm: q.bpm },
        ...(q.explanation.trim() === '' ? {} : { explanation: q.explanation }),
      };
      if (q.type === 'yes-no') return { ...common, type: 'yes-no', answer: q.answer };

      // Choice ids come from labels; a blank or repeated label falls back to its position.
      const used = new Set<string>();
      const idByKey = new Map<string, string>();
      const choices = q.choices.map((choice, choiceIndex) => {
        const slug = slugify(choice.label);
        const id = slug === '' || used.has(slug) ? `choice-${String(choiceIndex + 1)}` : slug;
        used.add(id);
        idByKey.set(choice.key, id);
        return { id, label: choice.label };
      });
      return {
        ...common,
        type: 'multiple-choice',
        choices,
        answer: idByKey.get(q.answerKey) ?? '',
      };
    }),
  };
}

/** Pretty-printed quiz file text for download. */
export function draftToJson(draft: QuizDraft): string {
  return `${JSON.stringify(draftToQuiz(draft), null, 2)}\n`;
}

/** Check a draft with exactly the rules an upload of its file would face. */
export function validateDraft(draft: QuizDraft): ReturnType<typeof parseQuizFile> {
  return parseQuizFile(draftToJson(draft));
}

/** Open an existing quiz in the builder. */
export function quizToDraft(quiz: Quiz, newKey: () => string): QuizDraft {
  return {
    label: quiz.label,
    description: quiz.description ?? '',
    questions: quiz.questions.map((q) => {
      const common = {
        key: newKey(),
        prompt: q.prompt,
        soundSet: q.sound.soundSet,
        bpm: q.sound.bpm,
        explanation: q.explanation ?? '',
      };
      if (q.type === 'yes-no') return { ...common, type: 'yes-no', answer: q.answer };

      const choices = q.choices.map((c) => ({ key: newKey(), label: c.label }));
      const answerIndex = q.choices.findIndex((c) => c.id === q.answer);
      return {
        ...common,
        type: 'multiple-choice',
        choices,
        answerKey: choices[answerIndex]?.key ?? '',
      };
    }),
  };
}
