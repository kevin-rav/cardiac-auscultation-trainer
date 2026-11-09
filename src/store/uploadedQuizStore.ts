import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Quiz } from '../engine/schema';
import { parseQuizFile } from './parseQuizFile';

/** localStorage key that holds quizzes uploaded on this device. */
export const UPLOADED_QUIZZES_STORAGE_KEY = 'cardiac-trainer-uploaded-quizzes';

const PersistedUploadsSchema = z.object({ quizzes: z.array(z.unknown()) });

export interface UploadedQuizState {
  quizzes: Quiz[];
  /** Adds the quiz, or replaces an uploaded quiz with the same id. */
  addQuiz: (quiz: Quiz) => 'added' | 'replaced';
  removeQuiz: (id: string) => void;
}

export const useUploadedQuizStore = create<UploadedQuizState>()(
  persist(
    (set, get) => ({
      quizzes: [],
      addQuiz: (quiz) => {
        const exists = get().quizzes.some((q) => q.id === quiz.id);
        set((state) => ({
          quizzes: exists
            ? state.quizzes.map((q) => (q.id === quiz.id ? quiz : q))
            : [...state.quizzes, quiz],
        }));
        return exists ? 'replaced' : 'added';
      },
      removeQuiz: (id) => {
        set((state) => ({ quizzes: state.quizzes.filter((q) => q.id !== id) }));
      },
    }),
    {
      name: UPLOADED_QUIZZES_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ quizzes: state.quizzes }),
      // Re-check every saved quiz on load with the upload rules. A quiz that no
      // longer passes (hand-edited, or a sound set was renamed in a later
      // deploy) is dropped rather than failing when the learner starts it.
      merge: (persisted, current) => {
        const parsed = PersistedUploadsSchema.safeParse(persisted);
        if (!parsed.success) return current;
        const quizzes = parsed.data.quizzes.flatMap((saved) => {
          const result = parseQuizFile(JSON.stringify(saved));
          return result.success ? [result.quiz] : [];
        });
        return { ...current, quizzes };
      },
    },
  ),
);
