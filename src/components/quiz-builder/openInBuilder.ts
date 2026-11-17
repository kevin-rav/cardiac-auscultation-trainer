import { quizzesRecord } from '../../data';
import { useQuizBuilderStore, useUploadedQuizStore, type Quiz, type QuizDraft } from '../../store';

/** URL query that asks the builder to open a quiz, e.g. `/builder?edit=my-quiz`. */
export const EDIT_PARAM = 'edit';

/** True when the draft has nothing an author typed, so replacing it loses no work. */
export function isDraftEmpty(draft: QuizDraft): boolean {
  if (draft.label.trim() !== '' || draft.description.trim() !== '') return false;
  return draft.questions.every(
    (q) =>
      q.prompt.trim() === '' &&
      q.soundSet === '' &&
      q.explanation.trim() === '' &&
      (q.type === 'yes-no' || q.choices.every((c) => c.label.trim() === '')),
  );
}

/** A built-in or uploaded quiz by id, or null if there is none. */
export function findQuiz(id: string | null): Quiz | null {
  if (id === null) return null;
  return (
    quizzesRecord[id] ?? useUploadedQuizStore.getState().quizzes.find((q) => q.id === id) ?? null
  );
}

/**
 * Replace the builder's draft with a quiz. A built-in quiz gets a new title,
 * because the builder will not download a quiz that reuses a built-in title.
 */
export function openInBuilder(quiz: Quiz): void {
  const { loadQuiz, setLabel } = useQuizBuilderStore.getState();
  loadQuiz(quiz);
  if (quizzesRecord[quiz.id] !== undefined) setLabel(`${quiz.label} (copy)`);
}
