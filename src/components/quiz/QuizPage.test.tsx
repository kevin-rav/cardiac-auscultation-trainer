import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardiacAudioPlayer } from '../../audio';
import { PRESET_QUIZZES } from '../../data';
import { setQuizPlayerInstance, useQuizStore } from '../../store';
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
const questionCount = quiz.questions.length;

function startFirstQuiz(): void {
  render(<QuizPage />);
  fireEvent.click(screen.getByRole('button', { name: `Start quiz: ${quizLabel}` }));
}

function clickAnswer(choice: boolean): void {
  fireEvent.click(screen.getByRole('button', { name: choice ? 'Yes' : 'No' }));
}

describe('QuizPage', () => {
  beforeEach(() => {
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
    expect(screen.getByText(quiz.label)).toBeDefined();
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
    const total = quiz.questions.length;

    quiz.questions.forEach((q, i) => {
      clickAnswer(q.answer);
      const isLast = i === total - 1;
      fireEvent.click(
        screen.getByRole('button', { name: isLast ? /see results/i : /next question/i }),
      );
    });

    expect(screen.getByText(`${String(total)} of ${String(total)} correct`)).toBeDefined();
  });

  it('shows what you answered and scores zero when every answer is wrong', () => {
    startFirstQuiz();
    const total = quiz.questions.length;

    quiz.questions.forEach((q, i) => {
      clickAnswer(!q.answer);
      const isLast = i === total - 1;
      fireEvent.click(
        screen.getByRole('button', { name: isLast ? /see results/i : /next question/i }),
      );
    });

    expect(screen.getByText(`0 of ${String(total)} correct`)).toBeDefined();
    expect(screen.getAllByText(/your answer:/i)).toHaveLength(total);
  });
});
