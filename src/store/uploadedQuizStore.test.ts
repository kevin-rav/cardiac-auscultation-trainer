import { beforeEach, describe, expect, it } from 'vitest';
import type { Quiz } from '../engine/schema';
import { PRESET_QUIZZES } from '../data';
import { UPLOADED_QUIZZES_STORAGE_KEY, useUploadedQuizStore } from './uploadedQuizStore';

function makeQuiz(id: string, label = 'Uploaded Quiz'): Quiz {
  return {
    id,
    label,
    questions: [
      {
        id: 'q1',
        type: 'yes-no',
        prompt: 'Is this an S3 gallop?',
        sound: { soundSet: 's3-gallop', bpm: 72 },
        answer: true,
      },
    ],
  };
}

function saveRaw(quizzes: unknown): void {
  localStorage.setItem(
    UPLOADED_QUIZZES_STORAGE_KEY,
    JSON.stringify({ state: { quizzes }, version: 1 }),
  );
}

describe('uploadedQuizStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useUploadedQuizStore.setState({ quizzes: [] });
  });

  it('adds a quiz', () => {
    expect(useUploadedQuizStore.getState().addQuiz(makeQuiz('a'))).toBe('added');
    expect(useUploadedQuizStore.getState().quizzes.map((q) => q.id)).toEqual(['a']);
  });

  it('replaces an uploaded quiz with the same id in place', () => {
    const store = useUploadedQuizStore.getState();
    store.addQuiz(makeQuiz('a', 'First'));
    store.addQuiz(makeQuiz('b'));

    expect(useUploadedQuizStore.getState().addQuiz(makeQuiz('a', 'Second'))).toBe('replaced');
    const { quizzes } = useUploadedQuizStore.getState();
    expect(quizzes.map((q) => q.id)).toEqual(['a', 'b']);
    expect(quizzes[0]?.label).toBe('Second');
  });

  it('removes a quiz', () => {
    const store = useUploadedQuizStore.getState();
    store.addQuiz(makeQuiz('a'));
    store.addQuiz(makeQuiz('b'));
    useUploadedQuizStore.getState().removeQuiz('a');

    expect(useUploadedQuizStore.getState().quizzes.map((q) => q.id)).toEqual(['b']);
  });

  it('writes quizzes to localStorage', () => {
    useUploadedQuizStore.getState().addQuiz(makeQuiz('a', 'Saved Quiz'));
    expect(localStorage.getItem(UPLOADED_QUIZZES_STORAGE_KEY)).toContain('"label":"Saved Quiz"');
  });

  it('restores saved quizzes from localStorage', async () => {
    saveRaw([makeQuiz('a')]);
    await useUploadedQuizStore.persist.rehydrate();
    expect(useUploadedQuizStore.getState().quizzes).toEqual([makeQuiz('a')]);
  });

  it('drops saved quizzes that no longer pass validation', async () => {
    const builtInId = PRESET_QUIZZES[0]?.id ?? 'identify-heart-sounds';
    const unknownSound = makeQuiz('bad-sound');
    unknownSound.questions[0] = {
      id: 'q1',
      type: 'yes-no',
      prompt: 'Is this a gallop?',
      sound: { soundSet: 's5-gallop', bpm: 72 },
      answer: true,
    };

    saveRaw([makeQuiz('good'), unknownSound, makeQuiz(builtInId), { not: 'a quiz' }]);
    await useUploadedQuizStore.persist.rehydrate();

    expect(useUploadedQuizStore.getState().quizzes.map((q) => q.id)).toEqual(['good']);
  });

  it('starts empty when saved data has the wrong shape', async () => {
    saveRaw('not-an-array');
    await useUploadedQuizStore.persist.rehydrate();
    expect(useUploadedQuizStore.getState().quizzes).toEqual([]);
  });
});
