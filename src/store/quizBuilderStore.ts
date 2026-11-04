import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Quiz } from '../engine/schema';
import {
  QuizDraftSchema,
  quizToDraft,
  type DraftChoice,
  type DraftQuestion,
  type QuizDraft,
} from './quizDraft';

/** localStorage key that holds the builder's unfinished quiz. */
export const QUIZ_DRAFT_STORAGE_KEY = 'cardiac-trainer-quiz-draft';

type QuestionType = DraftQuestion['type'];
type QuestionFields = Partial<Pick<DraftQuestion, 'prompt' | 'soundSet' | 'bpm' | 'explanation'>>;

const newKey = (): string => crypto.randomUUID();

const newChoice = (): DraftChoice => ({ key: newKey(), label: '' });

/** A blank question. The sound starts unset so the author must pick one. */
function newQuestion(type: QuestionType, from?: DraftQuestion): DraftQuestion {
  const common = {
    key: from?.key ?? newKey(),
    prompt: from?.prompt ?? '',
    soundSet: from?.soundSet ?? '',
    bpm: from?.bpm ?? 72,
    explanation: from?.explanation ?? '',
  };
  if (type === 'yes-no') return { ...common, type, answer: true };
  const choices = [newChoice(), newChoice()];
  return { ...common, type, choices, answerKey: choices[0]?.key ?? '' };
}

export const emptyDraft = (): QuizDraft => ({
  label: '',
  description: '',
  questions: [newQuestion('yes-no')],
});

export interface QuizBuilderState {
  draft: QuizDraft;

  setLabel: (label: string) => void;
  setDescription: (description: string) => void;

  addQuestion: (type: QuestionType) => void;
  updateQuestion: (key: string, fields: QuestionFields) => void;
  /** Switch between yes-no and multiple choice, keeping the prompt, sound and explanation. */
  setQuestionType: (key: string, type: QuestionType) => void;
  setYesNoAnswer: (key: string, answer: boolean) => void;
  moveQuestion: (key: string, offset: -1 | 1) => void;
  removeQuestion: (key: string) => void;

  addChoice: (questionKey: string) => void;
  updateChoice: (questionKey: string, choiceKey: string, label: string) => void;
  removeChoice: (questionKey: string, choiceKey: string) => void;
  setCorrectChoice: (questionKey: string, choiceKey: string) => void;

  /** Replace the draft with an existing quiz, to edit it. */
  loadQuiz: (quiz: Quiz) => void;
  reset: () => void;
}

export const useQuizBuilderStore = create<QuizBuilderState>()(
  persist(
    (set) => {
      const mapQuestions = (fn: (q: DraftQuestion) => DraftQuestion) => {
        set((state) => ({ draft: { ...state.draft, questions: state.draft.questions.map(fn) } }));
      };
      const mapQuestion = (key: string, fn: (q: DraftQuestion) => DraftQuestion) => {
        mapQuestions((q) => (q.key === key ? fn(q) : q));
      };
      const mapChoices = (
        key: string,
        fn: (q: Extract<DraftQuestion, { type: 'multiple-choice' }>) => DraftQuestion,
      ) => {
        mapQuestion(key, (q) => (q.type === 'multiple-choice' ? fn(q) : q));
      };

      return {
        draft: emptyDraft(),

        setLabel: (label) => {
          set((state) => ({ draft: { ...state.draft, label } }));
        },
        setDescription: (description) => {
          set((state) => ({ draft: { ...state.draft, description } }));
        },

        addQuestion: (type) => {
          set((state) => ({
            draft: { ...state.draft, questions: [...state.draft.questions, newQuestion(type)] },
          }));
        },
        updateQuestion: (key, fields) => {
          mapQuestion(key, (q) => ({ ...q, ...fields }));
        },
        setQuestionType: (key, type) => {
          mapQuestion(key, (q) => (q.type === type ? q : newQuestion(type, q)));
        },
        setYesNoAnswer: (key, answer) => {
          mapQuestion(key, (q) => (q.type === 'yes-no' ? { ...q, answer } : q));
        },
        moveQuestion: (key, offset) => {
          set((state) => {
            const questions = [...state.draft.questions];
            const from = questions.findIndex((q) => q.key === key);
            const to = from + offset;
            const moving = questions[from];
            if (from === -1 || to < 0 || to >= questions.length || !moving) return state;
            questions.splice(from, 1);
            questions.splice(to, 0, moving);
            return { draft: { ...state.draft, questions } };
          });
        },
        removeQuestion: (key) => {
          set((state) => ({
            draft: {
              ...state.draft,
              questions: state.draft.questions.filter((q) => q.key !== key),
            },
          }));
        },

        addChoice: (questionKey) => {
          mapChoices(questionKey, (q) => ({ ...q, choices: [...q.choices, newChoice()] }));
        },
        updateChoice: (questionKey, choiceKey, label) => {
          mapChoices(questionKey, (q) => ({
            ...q,
            choices: q.choices.map((c) => (c.key === choiceKey ? { ...c, label } : c)),
          }));
        },
        removeChoice: (questionKey, choiceKey) => {
          mapChoices(questionKey, (q) => {
            const choices = q.choices.filter((c) => c.key !== choiceKey);
            // If the correct choice is removed, fall back to the first one left.
            const answerKey = q.answerKey === choiceKey ? (choices[0]?.key ?? '') : q.answerKey;
            return { ...q, choices, answerKey };
          });
        },
        setCorrectChoice: (questionKey, choiceKey) => {
          mapChoices(questionKey, (q) =>
            q.choices.some((c) => c.key === choiceKey) ? { ...q, answerKey: choiceKey } : q,
          );
        },

        loadQuiz: (quiz) => {
          set({ draft: quizToDraft(quiz, newKey) });
        },
        reset: () => {
          set({ draft: emptyDraft() });
        },
      };
    },
    {
      name: QUIZ_DRAFT_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ draft: state.draft }),
      // A saved draft that does not match the draft shape is discarded.
      merge: (persisted, current) => {
        const parsed = z.object({ draft: QuizDraftSchema }).safeParse(persisted);
        return parsed.success ? { ...current, draft: parsed.data.draft } : current;
      },
    },
  ),
);
