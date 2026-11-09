import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardiacAudioPlayer } from '../../audio';
import { PRESET_QUIZZES } from '../../data';
import {
  MAX_QUIZ_FILE_BYTES,
  QUIZ_HISTORY_STORAGE_KEY,
  setQuizPlayerInstance,
  useQuizHistoryStore,
  useQuizStore,
  useUploadedQuizStore,
  type Quiz,
  type QuizAnswer,
  type QuizQuestion,
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

/** The button label for an answer: Yes or No, or the choice's label. */
function answerLabel(question: QuizQuestion, choice: QuizAnswer): string {
  if (typeof choice === 'boolean') return choice ? 'Yes' : 'No';
  const label =
    question.type === 'multiple-choice'
      ? question.choices.find((c) => c.id === choice)?.label
      : undefined;
  if (label === undefined) throw new Error(`No choice "${choice}" in question "${question.id}"`);
  return label;
}

function clickAnswer(question: QuizQuestion, choice: QuizAnswer): void {
  fireEvent.click(screen.getByRole('button', { name: answerLabel(question, choice) }));
}

/** Answers every question with `pick(question)` and clicks through to the results. */
function answerAll(pick: (question: QuizQuestion) => QuizAnswer): void {
  questions.forEach((q, i) => {
    clickAnswer(q, pick(q));
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
    useUploadedQuizStore.setState({ quizzes: [] });
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

    clickAnswer(firstQuestion, firstQuestion.answer);

    expect(screen.getByText('Correct')).toBeDefined();
    expect(next).toHaveProperty('disabled', false);
  });

  it('shows wrong feedback after a wrong answer', () => {
    startFirstQuiz();
    clickAnswer(firstQuestion, !firstQuestion.answer);
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
    clickAnswer(firstQuestion, firstQuestion.answer);
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

  describe('downloading quizzes', () => {
    it('downloads a quiz as a JSON file that can be uploaded again', async () => {
      const saved: string[] = [];
      const createUrl = vi.fn((blob: Blob) => {
        void blob.text().then((t) => saved.push(t));
        return 'blob:quiz';
      });
      vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(vi.fn());

      render(<QuizPage />);
      fireEvent.click(screen.getByRole('button', { name: `Download quiz: ${quizLabel}` }));
      await vi.waitFor(() => {
        expect(saved).toHaveLength(1);
      });

      expect(click).toHaveBeenCalledOnce();
      expect(JSON.parse(saved[0] ?? '')).toMatchObject({ id: quiz.id, label: quizLabel });

      click.mockRestore();
      vi.unstubAllGlobals();
    });
  });

  describe('uploading quizzes', () => {
    function uploadedQuiz(answers: [boolean, boolean] = [true, false], label = 'My Upload') {
      return {
        id: 'my-upload',
        label,
        questions: [
          {
            id: 'q1',
            type: 'yes-no',
            prompt: 'Is this an uploaded S3 question?',
            sound: { soundSet: 's3-gallop' },
            answer: answers[0],
          },
          {
            id: 'q2',
            type: 'yes-no',
            prompt: 'Is this an uploaded S4 question?',
            sound: { soundSet: 's4-gallop' },
            answer: answers[1],
          },
        ],
      };
    }

    function upload(content: string, name = 'quiz.json'): void {
      const file = new File([content], name, { type: 'application/json' });
      fireEvent.change(screen.getByLabelText('Quiz file'), { target: { files: [file] } });
    }

    it('adds a valid quiz and runs it', async () => {
      render(<QuizPage />);
      upload(JSON.stringify(uploadedQuiz()));

      expect((await screen.findByRole('status')).textContent).toContain('Added "My Upload"');
      fireEvent.click(screen.getByRole('button', { name: 'Start quiz: My Upload' }));
      expect(screen.getByText('Is this an uploaded S3 question?')).toBeDefined();
    });

    it('lists every problem and adds nothing for an invalid quiz', async () => {
      const quiz = uploadedQuiz();
      const [first, second] = quiz.questions;
      if (!first || !second) throw new Error('Expected two questions');
      first.sound.soundSet = 's5-gallop';
      second.id = 'q1';

      render(<QuizPage />);
      upload(JSON.stringify(quiz));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain(
        'questions.0.sound.soundSet: Unknown sound set "s5-gallop"',
      );
      expect(alert.textContent).toContain('questions.1.id: Duplicate question id "q1"');
      expect(useUploadedQuizStore.getState().quizzes).toEqual([]);
    });

    it('reports a file that is not JSON', async () => {
      render(<QuizPage />);
      upload('{ not json');
      expect((await screen.findByRole('alert')).textContent).toContain(
        'The file is not valid JSON',
      );
    });

    it('rejects a file over the size limit without reading it', async () => {
      render(<QuizPage />);
      upload('x'.repeat(MAX_QUIZ_FILE_BYTES + 1));
      expect((await screen.findByRole('alert')).textContent).toContain('larger than 1 MB');
    });

    it('uploads a quiz with warnings and shows them as a note', async () => {
      render(<QuizPage />);
      upload(JSON.stringify(uploadedQuiz([true, true])));

      const status = await screen.findByRole('status');
      expect(status.textContent).toContain('Added "My Upload"');
      expect(status.textContent).toContain('Every answer is "yes"');
      expect(useUploadedQuizStore.getState().quizzes).toHaveLength(1);
    });

    it('updates a quiz uploaded again with the same id', async () => {
      render(<QuizPage />);
      upload(JSON.stringify(uploadedQuiz()));
      await screen.findByRole('status');
      upload(JSON.stringify(uploadedQuiz([true, false], 'My Upload v2')));

      expect(await screen.findByText('Updated "My Upload v2"')).toBeDefined();
      expect(useUploadedQuizStore.getState().quizzes).toHaveLength(1);
    });

    it('removes an uploaded quiz', async () => {
      render(<QuizPage />);
      upload(JSON.stringify(uploadedQuiz()));
      await screen.findByRole('status');

      fireEvent.click(screen.getByRole('button', { name: 'Remove uploaded quiz: My Upload' }));
      expect(screen.queryByRole('button', { name: 'Start quiz: My Upload' })).toBeNull();
      expect(useUploadedQuizStore.getState().quizzes).toEqual([]);
    });
  });

  describe('multiple-choice questions', () => {
    const yesNoQuestion: QuizQuestion = {
      id: 'yn',
      type: 'yes-no',
      prompt: 'Is this a normal heart sound?',
      sound: { soundSet: 'normal-s1-s2', bpm: 72 },
      answer: true,
    };

    const mixedQuiz: Quiz = {
      id: 'mixed-quiz',
      label: 'Mixed Quiz',
      questions: [
        yesNoQuestion,
        {
          id: 'mc',
          type: 'multiple-choice',
          prompt: 'Which sound is this?',
          sound: { soundSet: 's3-gallop', bpm: 72 },
          choices: [
            { id: 's3', label: 'S3 gallop' },
            { id: 's4', label: 'S4 gallop' },
            { id: 'normal', label: 'Normal S1-S2' },
          ],
          answer: 's3',
          explanation: 'The extra sound comes just after S2.',
        },
      ],
    };

    function startMixedQuiz(): void {
      useUploadedQuizStore.setState({ quizzes: [mixedQuiz] });
      render(<QuizPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Start quiz: Mixed Quiz' }));
      clickAnswer(yesNoQuestion, true);
      fireEvent.click(screen.getByRole('button', { name: /next question/i }));
    }

    it('shows one button per choice instead of Yes and No', () => {
      startMixedQuiz();
      expect(screen.getByText('Which sound is this?')).toBeDefined();
      expect(screen.getByRole('button', { name: 'S3 gallop' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'S4 gallop' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Normal S1-S2' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
    });

    it('marks the correct choice and names it in the feedback', () => {
      startMixedQuiz();
      fireEvent.click(screen.getByRole('button', { name: 'S3 gallop' }));
      expect(screen.getByText('Correct')).toBeDefined();
      expect(screen.getByText('The answer is S3 gallop.')).toBeDefined();
    });

    it('names the correct choice after a wrong answer', () => {
      startMixedQuiz();
      fireEvent.click(screen.getByRole('button', { name: 'S4 gallop' }));
      expect(screen.getByText('Not quite')).toBeDefined();
      expect(screen.getByText('The answer is S3 gallop.')).toBeDefined();
    });

    it('shows choice labels in the results and in the saved attempt', () => {
      startMixedQuiz();
      fireEvent.click(screen.getByRole('button', { name: 'S4 gallop' }));
      fireEvent.click(screen.getByRole('button', { name: /see results/i }));

      expect(screen.getByText('Your answer: S4 gallop')).toBeDefined();
      expect(screen.getByText('Correct answer: S3 gallop')).toBeDefined();

      // The review must still show labels after the quiz itself is removed.
      fireEvent.click(screen.getByRole('button', { name: /back to quizzes/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove uploaded quiz: Mixed Quiz' }));
      fireEvent.click(screen.getByRole('button', { name: /review attempt: mixed quiz/i }));

      expect(screen.getByText('Your answer: S4 gallop')).toBeDefined();
      expect(screen.getByText('Correct answer: S3 gallop')).toBeDefined();
    });
  });
});
