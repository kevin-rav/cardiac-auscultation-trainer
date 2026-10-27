import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardiacAudioPlayer } from '../../audio';
import { PRESET_QUIZZES } from '../../data';
import type { YesNoQuestion } from '../../engine/schema';
import {
  QUIZ_HISTORY_STORAGE_KEY,
  setQuizPlayerInstance,
  useQuizHistoryStore,
  useQuizStore,
} from '../../store';
import { QuizPage } from './QuizPage';

const playFn = vi.fn<() => Promise<void>>();
const stopFn = vi.fn();

const mockPlayer = {
  play: playFn,
  stop: stopFn,
  setSoundSet: vi.fn(),
  setBpm: vi.fn(),
  setLoop: vi.fn(),
} as unknown as CardiacAudioPlayer;

const initialState = useQuizStore.getState();
const quiz = PRESET_QUIZZES[0];
if (quiz === undefined) throw new Error('Expected at least one preset quiz');
const firstQuestion = quiz.questions[0];
if (firstQuestion === undefined) throw new Error('Expected the preset quiz to have questions');
const quizLabel = quiz.label;
const questions = quiz.questions;
const questionCount = questions.length;

function startFirstQuiz(): void {
  render(<QuizPage />);
  fireEvent.click(screen.getByRole('button', { name: `Start quiz: ${quizLabel}` }));
}

function clickAnswer(choice: boolean): void {
  fireEvent.click(screen.getByRole('button', { name: choice ? 'Yes' : 'No' }));
}

/** Answers every question with `pick(question)` and clicks through to the results. */
function answerAll(pick: (question: YesNoQuestion) => boolean): void {
  questions.forEach((q, i) => {
    clickAnswer(pick(q));
    const isLast = i === questionCount - 1;
    fireEvent.click(
      screen.getByRole('button', { name: isLast ? /see results/i : /next question/i }),
    );
  });
}

describe('QuizPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useQuizHistoryStore.setState({ attempts: [] });
    useQuizStore.setState(initialState, true);
    setQuizPlayerInstance(mockPlayer);
    vi.clearAllMocks();
    playFn.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('lists the available quizzes', () => {
    render(<QuizPage />);
    expect(screen.getByText(quizLabel)).toBeDefined();
  });

  it('shows the first question after starting', () => {
    startFirstQuiz();
    expect(screen.getByText(firstQuestion.prompt)).toBeDefined();
    expect(screen.getByText(`Question 1 of ${String(questionCount)}`)).toBeDefined();
  });

  it('plays the sound when Play sound is clicked', () => {
    startFirstQuiz();
    fireEvent.click(screen.getByRole('button', { name: /play sound/i }));
    expect(playFn).toHaveBeenCalled();
  });

  it('shows correct feedback and enables Next after a right answer', () => {
    startFirstQuiz();
    const next = screen.getByRole('button', { name: /next question/i });
    expect(next).toHaveProperty('disabled', true);

    clickAnswer(firstQuestion.answer);

    expect(screen.getByText('Correct')).toBeDefined();
    expect(next).toHaveProperty('disabled', false);
  });

  it('shows wrong feedback after a wrong answer', () => {
    startFirstQuiz();
    clickAnswer(!firstQuestion.answer);
    expect(screen.getByText('Not quite')).toBeDefined();
  });

  it('shows the score after the last question', () => {
    startFirstQuiz();
    answerAll((q) => q.answer);

    expect(
      screen.getByText(`${String(questionCount)} of ${String(questionCount)} correct`),
    ).toBeDefined();
  });

  it('shows what you answered and scores zero when every answer is wrong', () => {
    startFirstQuiz();
    answerAll((q) => !q.answer);

    expect(screen.getByText(`0 of ${String(questionCount)} correct`)).toBeDefined();
    expect(screen.getAllByText(/your answer:/i)).toHaveLength(questionCount);
  });

  it('saves a finished attempt and lists it on the quiz picker', () => {
    startFirstQuiz();
    answerAll((q) => q.answer);

    const { attempts } = useQuizHistoryStore.getState();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.score).toBe(questionCount);
    expect(attempts[0]?.answers).toHaveLength(questionCount);

    fireEvent.click(screen.getByRole('button', { name: /back to quizzes/i }));

    expect(screen.getByText('Previous attempts')).toBeDefined();
    expect(screen.getByText(`${String(questionCount)}/${String(questionCount)}`)).toBeDefined();
  });

  it('persists the attempt in localStorage', () => {
    startFirstQuiz();
    answerAll((q) => q.answer);

    expect(localStorage.getItem(QUIZ_HISTORY_STORAGE_KEY)).toContain(firstQuestion.prompt);
  });

  it('saves each attempt separately', () => {
    startFirstQuiz();
    answerAll((q) => q.answer);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    answerAll((q) => !q.answer);

    const scores = useQuizHistoryStore.getState().attempts.map((a) => a.score);
    expect(scores).toEqual([0, questionCount]);
  });

  it('does not save a quiz that was exited before finishing', () => {
    startFirstQuiz();
    clickAnswer(firstQuestion.answer);
    fireEvent.click(screen.getByRole('button', { name: /exit quiz/i }));

    expect(useQuizHistoryStore.getState().attempts).toHaveLength(0);
    expect(screen.queryByText('Previous attempts')).toBeNull();
  });

  it('opens a saved attempt to review each answer', () => {
    startFirstQuiz();
    answerAll((q) => !q.answer);
    fireEvent.click(screen.getByRole('button', { name: /back to quizzes/i }));

    fireEvent.click(screen.getByRole('button', { name: /review attempt/i }));

    expect(screen.getByText(`${quizLabel} review`)).toBeDefined();
    expect(screen.getByText(`0 of ${String(questionCount)} correct`)).toBeDefined();
    expect(screen.getAllByText(/your answer:/i)).toHaveLength(questionCount);
    expect(screen.getAllByText(/correct answer:/i)).toHaveLength(questionCount);

    fireEvent.click(screen.getByRole('button', { name: /back to quizzes/i }));
    expect(screen.getByText('Previous attempts')).toBeDefined();
  });

  it('asks for confirmation before clearing the history', () => {
    startFirstQuiz();
    answerAll((q) => q.answer);
    fireEvent.click(screen.getByRole('button', { name: /back to quizzes/i }));

    fireEvent.click(screen.getByRole('button', { name: /clear history/i }));
    expect(screen.getByText(/delete all 1 saved attempts\?/i)).toBeDefined();
    expect(useQuizHistoryStore.getState().attempts).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(useQuizHistoryStore.getState().attempts).toHaveLength(1);
    expect(screen.getByText('Previous attempts')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /clear history/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));

    expect(useQuizHistoryStore.getState().attempts).toHaveLength(0);
    expect(screen.queryByText('Previous attempts')).toBeNull();
  });
});
