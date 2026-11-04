import { QuizSchema, type Quiz } from './schema';

export interface QuizIssue {
  /** Dot path to the field, e.g. "questions.2.sound.soundSet". Empty for the whole quiz. */
  path: string;
  message: string;
}

export type QuizValidationResult =
  { success: true; quiz: Quiz; warnings: QuizIssue[] } | { success: false; errors: QuizIssue[] };

/**
 * Validate a quiz from any source: a data file, an upload, or the builder.
 * Checks the schema, then that every sound set exists and question ids are
 * unique. Warnings flag quizzes that are valid but likely mistakes.
 */
export function validateQuiz(
  input: unknown,
  knownSoundSetIds: ReadonlySet<string>,
): QuizValidationResult {
  const parsed = QuizSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    };
  }

  const quiz = parsed.data;
  const errors: QuizIssue[] = [];
  const seenIds = new Set<string>();

  quiz.questions.forEach((question, index) => {
    if (!knownSoundSetIds.has(question.sound.soundSet)) {
      errors.push({
        path: `questions.${String(index)}.sound.soundSet`,
        message: `Unknown sound set "${question.sound.soundSet}"`,
      });
    }
    if (seenIds.has(question.id)) {
      errors.push({
        path: `questions.${String(index)}.id`,
        message: `Duplicate question id "${question.id}"`,
      });
    }
    seenIds.add(question.id);
  });

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const warnings: QuizIssue[] = [];
  const answers = new Set(quiz.questions.map((question) => question.answer));
  if (quiz.questions.length > 1 && answers.size === 1) {
    const only = answers.has(true) ? 'yes' : 'no';
    warnings.push({
      path: 'questions',
      message: `Every answer is "${only}", so the quiz can be passed without listening`,
    });
  }

  return { success: true, quiz, warnings };
}
