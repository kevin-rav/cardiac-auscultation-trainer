import { beforeEach, describe, expect, it } from 'vitest';
import type { Quiz } from '../engine/schema';
import { PRESET_QUIZZES } from '../data';
import { getCurrentQuestion, isAnswerCorrect, useQuizStore } from './quizStore';

const fixtureQuiz: Quiz = {
  id: 'fixture',
  label: 'Fixture Quiz',
  questions: [
    {
      id: 'q1',
      type: 'yes-no',
      prompt: 'Is this an S3 gallop?',
      sound: { soundSet: 's3-gallop', bpm: 72 },
      answer: true,
    },
    {
      id: 'q2',
      type: 'yes-no',
      prompt: 'Is this an S3 gallop?',
      sound: { soundSet: 's4-gallop', bpm: 90 },
      answer: false,
    },
  ],
};

const initialState = useQuizStore.getState();

function startFixture(): void {
  useQuizStore.setState({ quiz: fixtureQuiz, questionIndex: 0, selectedAnswer: null });
}

describe('QuizStore', () => {
  beforeEach(() => {
    useQuizStore.setState(initialState, true);
  });

  describe('startQuiz', () => {
    it('loads a preset quiz by id at its first question', () => {
      const preset = PRESET_QUIZZES[0];
      expect(preset).toBeDefined();
      if (!preset) return;

      expect(useQuizStore.getState().startQuiz(preset.id)).toBe(true);
      const state = useQuizStore.getState();
      expect(state.quiz?.id).toBe(preset.id);
      expect(getCurrentQuestion(state)).toEqual(preset.questions[0]);
    });

    it('returns false and changes nothing for an unknown id', () => {
      expect(useQuizStore.getState().startQuiz('no-such-quiz')).toBe(false);
      expect(useQuizStore.getState().quiz).toBeNull();
    });
  });

  describe('answer', () => {
    it('marks a matching answer correct', () => {
      startFixture();
      useQuizStore.getState().answer(true);
      expect(isAnswerCorrect(useQuizStore.getState())).toBe(true);
    });

    it('marks a wrong answer incorrect', () => {
      startFixture();
      useQuizStore.getState().answer(false);
      expect(isAnswerCorrect(useQuizStore.getState())).toBe(false);
    });

    it('reports no result before the question is answered', () => {
      startFixture();
      expect(isAnswerCorrect(useQuizStore.getState())).toBeNull();
    });

    it('keeps the first answer when answered again', () => {
      startFixture();
      useQuizStore.getState().answer(false);
      useQuizStore.getState().answer(true);
      expect(useQuizStore.getState().selectedAnswer).toBe(false);
    });

    it('does nothing when no quiz is loaded', () => {
      useQuizStore.getState().answer(true);
      expect(useQuizStore.getState().selectedAnswer).toBeNull();
    });
  });

  describe('nextQuestion', () => {
    it('does not advance before the current question is answered', () => {
      startFixture();
      useQuizStore.getState().nextQuestion();
      expect(useQuizStore.getState().questionIndex).toBe(0);
    });

    it('advances and clears the answer', () => {
      startFixture();
      useQuizStore.getState().answer(true);
      useQuizStore.getState().nextQuestion();

      const state = useQuizStore.getState();
      expect(state.questionIndex).toBe(1);
      expect(state.selectedAnswer).toBeNull();
      expect(getCurrentQuestion(state)?.id).toBe('q2');
    });

    it('finishes after the last question', () => {
      startFixture();
      for (const question of fixtureQuiz.questions) {
        useQuizStore.getState().answer(question.answer);
        useQuizStore.getState().nextQuestion();
      }
      expect(useQuizStore.getState().isFinished).toBe(true);
    });
  });

  describe('restart and exitQuiz', () => {
    it('restart returns to the first question of the same quiz', () => {
      startFixture();
      useQuizStore.getState().answer(true);
      useQuizStore.getState().nextQuestion();
      useQuizStore.getState().restart();

      const state = useQuizStore.getState();
      expect(state.quiz?.id).toBe('fixture');
      expect(state.questionIndex).toBe(0);
      expect(state.selectedAnswer).toBeNull();
      expect(state.isFinished).toBe(false);
    });

    it('exitQuiz unloads the quiz', () => {
      startFixture();
      useQuizStore.getState().exitQuiz();
      const state = useQuizStore.getState();
      expect(state.quiz).toBeNull();
      expect(getCurrentQuestion(state)).toBeNull();
    });
  });
});
