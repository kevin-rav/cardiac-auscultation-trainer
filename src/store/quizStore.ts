import { create } from 'zustand';
import { CardiacAudioPlayer } from '../audio';
import type { Quiz, SoundSet, YesNoQuestion } from '../engine/schema';
import { manifest, quizzesRecord, soundSetsRecord } from '../data';

export interface QuizState {
  quiz: Quiz | null;
  questionIndex: number;
  /** The learner's answer to the current question, or null before they answer. */
  selectedAnswer: boolean | null;
  isFinished: boolean;
  isPlaying: boolean;
  audioError: string | null;

  startQuiz: (id: string) => boolean;
  answer: (choice: boolean) => void;
  nextQuestion: () => void;
  restart: () => void;
  exitQuiz: () => void;
  /** Play the current question's sound set on a loop until stopped. */
  playSound: () => void;
  stopSound: () => void;
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

let quizPlayer: CardiacAudioPlayer | null = null;

function getPlayer(soundSet: SoundSet): CardiacAudioPlayer {
  if (!quizPlayer) {
    quizPlayer = new CardiacAudioPlayer(soundSet, undefined, manifest);
    void quizPlayer.getSampleLoader().preloadManifest(manifest);
  }
  return quizPlayer;
}

export function setQuizPlayerInstance(player: CardiacAudioPlayer | null): void {
  quizPlayer = player;
}

const initialProgress = {
  questionIndex: 0,
  selectedAnswer: null,
  isFinished: false,
};

export const useQuizStore = create<QuizState>((set, get) => ({
  quiz: null,
  ...initialProgress,
  isPlaying: false,
  audioError: null,

  startQuiz: (id) => {
    const quiz = quizzesRecord[id];
    if (!quiz) return false;
    get().stopSound();
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

    get().stopSound();
    const next = questionIndex + 1;
    if (next >= quiz.questions.length) {
      set({ isFinished: true });
      return;
    }
    set({ questionIndex: next, selectedAnswer: null });
  },

  restart: () => {
    if (!get().quiz) return;
    get().stopSound();
    set(initialProgress);
  },

  exitQuiz: () => {
    get().stopSound();
    set({ quiz: null, ...initialProgress });
  },

  playSound: () => {
    const question = getCurrentQuestion(get());
    if (!question) return;

    const soundSet = soundSetsRecord[question.sound.soundSet];
    if (!soundSet) {
      set({ audioError: `Unknown sound set "${question.sound.soundSet}"` });
      return;
    }

    const player = getPlayer(soundSet);
    player.stop();
    player.setSoundSet(soundSet);
    player.setBpm(question.sound.bpm);
    player.setLoop(true);
    set({ isPlaying: true, audioError: null });
    player.play().catch((err: unknown) => {
      set({ isPlaying: false, audioError: err instanceof Error ? err.message : String(err) });
    });
  },

  stopSound: () => {
    quizPlayer?.stop();
    set({ isPlaying: false });
  },
}));
