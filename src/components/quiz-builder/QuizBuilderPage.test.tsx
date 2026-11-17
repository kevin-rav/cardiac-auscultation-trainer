import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadTextFile } from '../../lib/downloadFile';
import { parseQuizFile, useQuizBuilderStore, type QuizDraft } from '../../store';
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

  describe('multiple-choice questions', () => {
    /** The card for question `n`, so its fields can be found by their plain labels. */
    const card = (n: number) => {
      const item = screen
        .getAllByRole('listitem')
        .find((li) =>
          within(li).queryByRole('heading', { level: 3, name: `Question ${String(n)}` }),
        );
      if (item === undefined) throw new Error(`No card for question ${String(n)}`);
      return within(item);
    };

    const choiceQuestion = () => {
      const q = useQuizBuilderStore.getState().draft.questions[0];
      if (q?.type !== 'multiple-choice') throw new Error('Expected a multiple-choice question');
      return q;
    };

    function setChoiceDraft(labels: string[]): void {
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
            choices: labels.map((label, i) => ({ key: `c${String(i + 1)}`, label })),
            answerKey: 'c1',
          },
        ],
      });
    }

    it('adds a multiple-choice question with two empty choices', () => {
      render(<QuizBuilderPage />);

      fireEvent.click(screen.getByRole('button', { name: /add multiple-choice question/i }));

      const q2 = card(2);
      expect(q2.getByLabelText('Question type')).toHaveProperty('value', 'multiple-choice');
      expect(q2.getByLabelText('Choice 1')).toHaveProperty('value', '');
      expect(q2.getByLabelText('Choice 2')).toHaveProperty('value', '');
      expect(q2.getByLabelText('Choice 1 is correct')).toHaveProperty('checked', true);
      expect(screen.getByText('Question 2: choice 1 needs a label')).toBeDefined();
      expect(screen.getByText('Question 2: choice 2 needs a label')).toBeDefined();
    });

    it('edits a choice label and picks the correct choice', () => {
      setChoiceDraft(['Normal', 'Murmur']);
      render(<QuizBuilderPage />);

      fireEvent.change(screen.getByLabelText('Choice 2'), { target: { value: 'S3 gallop' } });
      fireEvent.click(screen.getByLabelText('Choice 2 is correct'));

      const q = choiceQuestion();
      expect(q.choices.map((c) => c.label)).toEqual(['Normal', 'S3 gallop']);
      expect(q.answerKey).toBe('c2');
      expect(screen.getByLabelText('Choice 1 is correct')).toHaveProperty('checked', false);
    });

    it('adds choices up to 6 and removes them down to 2', () => {
      setChoiceDraft(['A', 'B']);
      render(<QuizBuilderPage />);

      const add = screen.getByRole('button', { name: 'Add choice' });
      expect(screen.getByRole('button', { name: 'Remove choice 1' })).toHaveProperty(
        'disabled',
        true,
      );

      for (let i = 0; i < 4; i++) fireEvent.click(add);
      expect(choiceQuestion().choices).toHaveLength(6);
      expect(add).toHaveProperty('disabled', true);
      expect(screen.getByText('Up to 6 choices.')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Remove choice 1' }));
      expect(choiceQuestion().choices).toHaveLength(5);
      expect(add).toHaveProperty('disabled', false);
    });

    it('moves the correct answer to the first choice left when it is removed', () => {
      setChoiceDraft(['A', 'B', 'C']);
      render(<QuizBuilderPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Remove choice 1' }));

      expect(choiceQuestion().choices.map((c) => c.label)).toEqual(['B', 'C']);
      expect(screen.getByLabelText('Choice 1 is correct')).toHaveProperty('checked', true);
    });

    it('keeps the prompt, sound and explanation when the type is switched', () => {
      render(<QuizBuilderPage />);
      fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'Which sound?' } });
      fireEvent.change(screen.getByLabelText('Sound'), { target: { value: 's3-gallop' } });
      fireEvent.change(screen.getByLabelText('Explanation (optional)'), {
        target: { value: 'Early diastole.' },
      });

      fireEvent.change(screen.getByLabelText('Question type'), {
        target: { value: 'multiple-choice' },
      });
      expect(screen.getByLabelText('Choice 1')).toBeDefined();

      fireEvent.change(screen.getByLabelText('Question type'), { target: { value: 'yes-no' } });
      expect(screen.queryByLabelText('Choice 1')).toBeNull();
      expect(screen.getByLabelText('Yes')).toBeDefined();

      const [q] = useQuizBuilderStore.getState().draft.questions;
      expect(q?.prompt).toBe('Which sound?');
      expect(q?.soundSet).toBe('s3-gallop');
      expect(q?.explanation).toBe('Early diastole.');
      expect(screen.getByLabelText('Prompt')).toHaveProperty('value', 'Which sound?');
    });

    it('blocks download while two choices have the same label', () => {
      setChoiceDraft(['Murmur', ' murmur ']);
      render(<QuizBuilderPage />);

      expect(screen.getByText('Question 1: choice 2 is the same as another choice')).toBeDefined();
      const download = screen.getByRole('button', { name: /download quiz/i });
      expect(download).toHaveProperty('disabled', true);

      fireEvent.change(screen.getByLabelText('Choice 2'), { target: { value: 'Normal' } });
      expect(download).toHaveProperty('disabled', false);
    });

    it('blocks download while a choice is only spaces', () => {
      setChoiceDraft(['Normal', '   ']);
      render(<QuizBuilderPage />);

      expect(screen.getByText('Question 1: choice 2 needs a label')).toBeDefined();
      expect(screen.getByRole('button', { name: /download quiz/i })).toHaveProperty(
        'disabled',
        true,
      );
    });

    it('downloads a mixed quiz that passes the upload checks', () => {
      setDraft(validDraft('Mixed'));
      render(<QuizBuilderPage />);

      fireEvent.click(screen.getByRole('button', { name: /add multiple-choice question/i }));
      const q2 = card(2);
      fireEvent.change(q2.getByLabelText('Prompt'), { target: { value: 'Which sound is this?' } });
      fireEvent.change(q2.getByLabelText('Sound'), { target: { value: 's3-gallop' } });
      fireEvent.change(q2.getByLabelText('Choice 1'), { target: { value: 'S4 gallop' } });
      fireEvent.change(q2.getByLabelText('Choice 2'), { target: { value: 'S3 gallop' } });
      fireEvent.click(q2.getByLabelText('Choice 2 is correct'));

      fireEvent.click(screen.getByRole('button', { name: /download quiz/i }));

      const text = vi.mocked(downloadTextFile).mock.calls[0]?.[1] ?? '';
      const uploaded = parseQuizFile(text);
      if (!uploaded.success) throw new Error(uploaded.errors.map((e) => e.message).join('; '));
      const [yesNo, choice] = uploaded.quiz.questions;
      expect(yesNo?.type).toBe('yes-no');
      expect(choice?.type === 'multiple-choice' && choice.answer).toBe('s3-gallop');
    });
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
