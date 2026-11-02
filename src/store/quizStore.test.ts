import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardiacAudioPlayer } from '../audio';
import type { Quiz } from '../engine/schema';
import { PRESET_QUIZZES, soundSetsRecord } from '../data';
import {
  getCurrentQuestion,
  isAnswerCorrect,
  setQuizPlayerInstance,
  useQuizStore,
} from './quizStore';

const playFn = vi.fn<() => Promise<void>>();
const stopFn = vi.fn();
const setSoundSetFn = vi.fn();
const setBpmFn = vi.fn();
const setLoopFn = vi.fn();

const mockPlayer = {
  play: playFn,
  stop: stopFn,
  setSoundSet: setSoundSetFn,
  setBpm: setBpmFn,
  setLoop: setLoopFn,
} as unknown as CardiacAudioPlayer;

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
    setQuizPlayerInstance(mockPlayer);
    vi.clearAllMocks();
    playFn.mockResolvedValue(undefined);
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

  describe('playSound', () => {
    it('plays the current question sound set at its bpm on a loop', () => {
      startFixture();
      useQuizStore.getState().playSound();

      expect(setSoundSetFn).toHaveBeenCalledWith(soundSetsRecord['s3-gallop']);
      expect(setBpmFn).toHaveBeenCalledWith(72);
      expect(setLoopFn).toHaveBeenCalledWith(true);
      expect(playFn).toHaveBeenCalledOnce();
      expect(useQuizStore.getState().isPlaying).toBe(true);
    });

    it('stops the previous sound before playing again', () => {
      startFixture();
      useQuizStore.getState().playSound();
      useQuizStore.getState().playSound();

      expect(stopFn).toHaveBeenCalledTimes(2);
      expect(stopFn.mock.invocationCallOrder[1]).toBeLessThan(
        playFn.mock.invocationCallOrder[1] ?? 0,
      );
    });

    it('plays the next question at its own sound set and bpm', () => {
      startFixture();
      useQuizStore.getState().answer(true);
      useQuizStore.getState().nextQuestion();
      useQuizStore.getState().playSound();

      expect(setSoundSetFn).toHaveBeenLastCalledWith(soundSetsRecord['s4-gallop']);
      expect(setBpmFn).toHaveBeenLastCalledWith(90);
    });

    it('reports an error for a sound set that does not exist', () => {
      useQuizStore.setState({
        quiz: {
          ...fixtureQuiz,
          questions: [
            {
              id: 'missing',
              type: 'yes-no',
              prompt: 'Is this a sound?',
              sound: { soundSet: 'no-such-set', bpm: 72 },
              answer: true,
            },
          ],
        },
      });
      useQuizStore.getState().playSound();

      expect(playFn).not.toHaveBeenCalled();
      expect(useQuizStore.getState().audioError).toBe('Unknown sound set "no-such-set"');
    });

    it('resets isPlaying and reports an error when playback fails', async () => {
      playFn.mockRejectedValueOnce(new Error('AudioContext blocked'));
      startFixture();
      useQuizStore.getState().playSound();
      await Promise.resolve();

      const state = useQuizStore.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.audioError).toBe('AudioContext blocked');
    });

    it('does nothing when no quiz is loaded', () => {
      useQuizStore.getState().playSound();
      expect(playFn).not.toHaveBeenCalled();
    });
  });

  describe('stopping sound', () => {
    it('stopSound stops the player', () => {
      startFixture();
      useQuizStore.getState().playSound();
      useQuizStore.getState().stopSound();

      expect(stopFn).toHaveBeenCalled();
      expect(useQuizStore.getState().isPlaying).toBe(false);
    });

    it.each(['nextQuestion', 'restart', 'exitQuiz'] as const)('%s stops the sound', (action) => {
      startFixture();
      useQuizStore.getState().answer(true);
      useQuizStore.getState().playSound();
      stopFn.mockClear();

      useQuizStore.getState()[action]();
      expect(stopFn).toHaveBeenCalled();
      expect(useQuizStore.getState().isPlaying).toBe(false);
    });
  });
});
