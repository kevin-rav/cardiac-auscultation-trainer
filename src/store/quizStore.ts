import { create } from 'zustand';
import type { Quiz, YesNoQuestion } from '../engine/schema';
import { quizzesRecord } from '../data';

export interface QuizState {
  quiz: Quiz | null;
  questionIndex: number;
  /** The learner's answer to the current question, or null before they answer. */
  selectedAnswer: boolean | null;
  isFinished: boolean;

  startQuiz: (id: string) => boolean;
  answer: (choice: boolean) => void;
  nextQuestion: () => void;
  restart: () => void;
  exitQuiz: () => void;
}

export function getCurrentQuestion(state: QuizState): YesNoQuestion | null {
  return state.quiz?.questions[state.questionIndex] ?? null;
}

/** Null until the current question is answered. */
export function isAnswerCorrect(state: QuizState): boolean | null {
  const question = getCurrentQuestion(state);
  if (!question || state.selectedAnswer === null) return null;
  return state.selectedAnswer === question.answer;
}

const initialProgress = {
  questionIndex: 0,
  selectedAnswer: null,
  isFinished: false,
};

export const useQuizStore = create<QuizState>((set, get) => ({
  quiz: null,
  ...initialProgress,

  startQuiz: (id) => {
    const quiz = quizzesRecord[id];
    if (!quiz) return false;
    set({ quiz, ...initialProgress });
    return true;
  },

  answer: (choice) => {
    const state = get();
    // Lock in the first answer so feedback cannot be changed by clicking again.
    if (!getCurrentQuestion(state) || state.selectedAnswer !== null) return;
    set({ selectedAnswer: choice });
  },

  nextQuestion: () => {
    const { quiz, questionIndex, selectedAnswer } = get();
    if (!quiz || selectedAnswer === null) return;

    const next = questionIndex + 1;
    if (next >= quiz.questions.length) {
      set({ isFinished: true });
      return;
    }
    set({ questionIndex: next, selectedAnswer: null });
  },

  restart: () => {
    if (!get().quiz) return;
    set(initialProgress);
  },

  exitQuiz: () => {
    set({ quiz: null, ...initialProgress });
  },
}));
