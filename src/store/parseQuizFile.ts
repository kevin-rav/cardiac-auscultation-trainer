import { SOUND_SET_IDS, quizzesRecord } from '../data';
import { validateQuiz, type QuizValidationResult } from '../engine/quizValidation';

/** Files larger than this are rejected before reading. A real quiz is a few KB. */
export const MAX_QUIZ_FILE_BYTES = 1024 * 1024;

/**
 * Turn the text of an uploaded quiz file into a validated quiz, using the same
 * rules as the built-in quiz files. Uploads may not reuse a built-in quiz id.
 */
export function parseQuizFile(text: string): QuizValidationResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { success: false, errors: [{ path: '', message: 'The file is not valid JSON' }] };
  }

  const result = validateQuiz(json, SOUND_SET_IDS);
  if (result.success && quizzesRecord[result.quiz.id] !== undefined) {
    return {
      success: false,
      errors: [
        {
          path: 'id',
          message: `"${result.quiz.id}" is used by a built-in quiz. Change the id to upload it.`,
        },
      ],
    };
  }
  return result;
}
export type { QuizIssue } from '../engine/quizValidation';
