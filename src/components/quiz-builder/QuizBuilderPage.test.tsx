import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadTextFile } from '../../lib/downloadFile';
import { useQuizBuilderStore, type QuizDraft } from '../../store';
import { QuizBuilderPage } from './QuizBuilderPage';

vi.mock('../../lib/downloadFile', () => ({ downloadTextFile: vi.fn() }));

/** A draft that passes every rule, with the given title. */
function validDraft(label: string): QuizDraft {
  return {
    label,
    description: '',
    questions: [
      {
        key: 'k1',
        type: 'yes-no',
        prompt: 'Is this a normal heart sound?',
        soundSet: 'normal-s1-s2',
        bpm: 72,
        explanation: '',
        answer: true,
      },
    ],
  };
}

function setDraft(draft: QuizDraft): void {
  useQuizBuilderStore.setState({ draft });
}

describe('QuizBuilderPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useQuizBuilderStore.getState().reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('starts with one empty question and lists what is missing', () => {
    render(<QuizBuilderPage />);

    expect(screen.getByRole('heading', { name: 'Quiz Builder' })).toBeDefined();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    expect(screen.getByText('Give the quiz a title')).toBeDefined();
    expect(screen.getByText('Question 1: write the question')).toBeDefined();
    expect(screen.getByText('Question 1: choose a sound')).toBeDefined();
    expect(screen.getByRole('button', { name: /download quiz/i })).toHaveProperty('disabled', true);
  });

  it('saves what is typed into the draft', () => {
    render(<QuizBuilderPage />);

    fireEvent.change(screen.getByLabelText('Quiz title'), { target: { value: 'My Quiz' } });
    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'Is this S3?' } });
    fireEvent.change(screen.getByLabelText('Sound'), { target: { value: 's3-gallop' } });
    fireEvent.click(screen.getByLabelText('No'));
    fireEvent.change(screen.getByLabelText('Heart rate (BPM)'), { target: { value: '90' } });

    const { draft } = useQuizBuilderStore.getState();
    const question = draft.questions[0];
    expect(draft.label).toBe('My Quiz');
    expect(question?.prompt).toBe('Is this S3?');
    expect(question?.soundSet).toBe('s3-gallop');
    expect(question?.bpm).toBe(90);
    expect(question?.type === 'yes-no' && question.answer).toBe(false);
  });

  it('enables download once the quiz is complete and saves it as a file', () => {
    render(<QuizBuilderPage />);

    fireEvent.change(screen.getByLabelText('Quiz title'), { target: { value: 'My Quiz' } });
    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'Is this normal?' } });
    fireEvent.change(screen.getByLabelText('Sound'), { target: { value: 'normal-s1-s2' } });

    expect(screen.getByText('Ready to download')).toBeDefined();
    const download = screen.getByRole('button', { name: /download quiz/i });
    expect(download).toHaveProperty('disabled', false);

    fireEvent.click(download);

    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const call = vi.mocked(downloadTextFile).mock.calls[0];
    expect(call?.[0]).toBe('my-quiz.json');
    expect(call?.[1]).toContain('"label": "My Quiz"');
  });

  it('explains a heart rate that is out of range', () => {
    render(<QuizBuilderPage />);

    fireEvent.change(screen.getByLabelText('Heart rate (BPM)'), { target: { value: '300' } });

    expect(screen.getByText('Question 1: heart rate must be between 30 and 220 BPM')).toBeDefined();
  });

  it('does not allow a title that matches a built-in quiz', () => {
    setDraft(validDraft('Identify Heart Sounds'));
    render(<QuizBuilderPage />);

    expect(
      screen.getByText('This title matches a built-in quiz. Choose a different title'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /download quiz/i })).toHaveProperty('disabled', true);
  });

  it('adds and removes questions', () => {
    render(<QuizBuilderPage />);

    fireEvent.click(screen.getByRole('button', { name: /add yes\/no question/i }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Remove question 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove question 1' }));

    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.getByText('Add at least one question')).toBeDefined();
  });

  it('moves a question down', () => {
    const first = validDraft('Order');
    const [question] = first.questions;
    if (question === undefined) throw new Error('Expected a question');
    setDraft({
      ...first,
      questions: [
        { ...question, key: 'a', prompt: 'First' },
        { ...question, key: 'b', prompt: 'Second' },
      ],
    });
    render(<QuizBuilderPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Move question 1 down' }));

    const prompts = useQuizBuilderStore.getState().draft.questions.map((q) => q.prompt);
    expect(prompts).toEqual(['Second', 'First']);
  });

  it('says that multiple-choice answers cannot be edited yet', () => {
    setDraft({
      label: 'Choices',
      description: '',
      questions: [
        {
          key: 'm1',
          type: 'multiple-choice',
          prompt: 'Which sound is this?',
          soundSet: 'normal-s1-s2',
          bpm: 72,
          explanation: '',
          choices: [
            { key: 'c1', label: 'Normal' },
            { key: 'c2', label: 'Murmur' },
          ],
          answerKey: 'c1',
        },
      ],
    });
    render(<QuizBuilderPage />);

    expect(screen.getByText(/can't be edited in the builder yet/i)).toBeDefined();
  });

  it('asks before erasing the draft', () => {
    setDraft(validDraft('Keep me'));
    render(<QuizBuilderPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByText('Erase this draft?')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Quiz title')).toHaveProperty('value', 'Keep me');

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    fireEvent.click(screen.getByRole('button', { name: 'Erase draft' }));
    expect(screen.getByLabelText('Quiz title')).toHaveProperty('value', '');
  });
});
