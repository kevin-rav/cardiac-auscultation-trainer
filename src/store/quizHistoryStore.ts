import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** localStorage key that holds the saved quiz attempts. */
export const QUIZ_HISTORY_STORAGE_KEY = 'cardiac-trainer-quiz-history';

/** Only the most recent attempts are kept so storage cannot grow forever. */
export const MAX_SAVED_ATTEMPTS = 20;

export const QuizAttemptSchema = z.object({
  quizId: z.string(),
  /** Saved so the history still reads well if the quiz is later renamed or removed. */
  quizLabel: z.string(),
  /** Epoch milliseconds, from Date.now(). */
  finishedAt: z.number(),
  score: z.number().int().min(0),
  total: z.number().int().min(1),
  /**
   * One entry per answered question. The prompt, correct answer and explanation
   * are copied in so an old attempt can still be reviewed after the quiz changes.
   */
  answers: z.array(
    z.object({
      questionId: z.string(),
      prompt: z.string(),
      selected: z.boolean(),
      correctAnswer: z.boolean(),
      explanation: z.string().optional(),
    }),
  ),
});
export type QuizAttempt = z.infer<typeof QuizAttemptSchema>;

const PersistedHistorySchema = z.object({ attempts: z.array(QuizAttemptSchema) });

export interface QuizHistoryState {
  /** Finished attempts, newest first. */
  attempts: QuizAttempt[];
  addAttempt: (attempt: QuizAttempt) => void;
  clearHistory: () => void;
}

export const useQuizHistoryStore = create<QuizHistoryState>()(
  persist(
    (set) => ({
      attempts: [],
      addAttempt: (attempt) => {
        set((state) => ({
          attempts: [attempt, ...state.attempts].slice(0, MAX_SAVED_ATTEMPTS),
        }));
      },
      clearHistory: () => {
        set({ attempts: [] });
      },
    }),
    {
      name: QUIZ_HISTORY_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ attempts: state.attempts }),
      // Never trust what is in localStorage: if it does not match the schema
      // (old format, hand-edited, corrupted), start with an empty history.
      merge: (persisted, current) => {
        const parsed = PersistedHistorySchema.safeParse(persisted);
        return parsed.success ? { ...current, attempts: parsed.data.attempts } : current;
      },
    },
  ),
);
