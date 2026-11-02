import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_SAVED_ATTEMPTS,
  QUIZ_HISTORY_STORAGE_KEY,
  useQuizHistoryStore,
  type QuizAttempt,
} from './quizHistoryStore';

function makeAttempt(finishedAt: number): QuizAttempt {
  return {
    quizId: 'demo-quiz',
    quizLabel: 'Demo Quiz',
    finishedAt,
    score: 1,
    total: 2,
    answers: [
      {
        questionId: 'q1',
        prompt: 'Is this a normal heart sound?',
        selected: true,
        correctAnswer: true,
        explanation: 'Only S1 and S2 are present.',
      },
      {
        questionId: 'q2',
        prompt: 'Is this an S3 gallop?',
        selected: true,
        correctAnswer: false,
      },
    ],
  };
}

describe('quizHistoryStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useQuizHistoryStore.setState({ attempts: [] });
  });

  it('adds attempts newest first', () => {
    useQuizHistoryStore.getState().addAttempt(makeAttempt(1));
    useQuizHistoryStore.getState().addAttempt(makeAttempt(2));

    const times = useQuizHistoryStore.getState().attempts.map((a) => a.finishedAt);
    expect(times).toEqual([2, 1]);
  });

  it('keeps only the most recent attempts', () => {
    for (let i = 1; i <= MAX_SAVED_ATTEMPTS + 5; i++) {
      useQuizHistoryStore.getState().addAttempt(makeAttempt(i));
    }

    const { attempts } = useQuizHistoryStore.getState();
    expect(attempts).toHaveLength(MAX_SAVED_ATTEMPTS);
    expect(attempts[0]?.finishedAt).toBe(MAX_SAVED_ATTEMPTS + 5);
  });

  it('clears the history', () => {
    useQuizHistoryStore.getState().addAttempt(makeAttempt(1));
    useQuizHistoryStore.getState().clearHistory();

    expect(useQuizHistoryStore.getState().attempts).toEqual([]);
  });

  it('writes attempts to localStorage', () => {
    useQuizHistoryStore.getState().addAttempt(makeAttempt(1));

    const raw = localStorage.getItem(QUIZ_HISTORY_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).toContain('"quizLabel":"Demo Quiz"');
  });

  it('restores saved attempts from localStorage', async () => {
    localStorage.setItem(
      QUIZ_HISTORY_STORAGE_KEY,
      JSON.stringify({ state: { attempts: [makeAttempt(5)] }, version: 1 }),
    );

    await useQuizHistoryStore.persist.rehydrate();

    expect(useQuizHistoryStore.getState().attempts).toEqual([makeAttempt(5)]);
  });

  it('ignores saved data that does not match the schema', async () => {
    localStorage.setItem(
      QUIZ_HISTORY_STORAGE_KEY,
      JSON.stringify({ state: { attempts: 'not-an-array' }, version: 1 }),
    );

    await useQuizHistoryStore.persist.rehydrate();

    expect(useQuizHistoryStore.getState().attempts).toEqual([]);
  });
});
