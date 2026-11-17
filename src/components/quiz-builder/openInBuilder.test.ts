import { beforeEach, describe, expect, it } from 'vitest';
import { PRESET_QUIZZES } from '../../data';
import { emptyDraft, useUploadedQuizStore, type Quiz, type QuizDraft } from '../../store';
import { findQuiz, isDraftEmpty } from './openInBuilder';

const uploaded: Quiz = {
  id: 'my-upload',
  label: 'My Upload',
  questions: [
    {
      id: 'q1',
      type: 'yes-no',
      prompt: 'Is this S3?',
      sound: { soundSet: 's3-gallop', bpm: 72 },
      answer: true,
    },
  ],
};

describe('isDraftEmpty', () => {
  it('is true for a new draft, even with extra blank questions or a changed heart rate', () => {
    const draft = emptyDraft();
    const [first] = draft.questions;
    if (first === undefined) throw new Error('Expected a question');
    expect(isDraftEmpty(draft)).toBe(true);
    expect(isDraftEmpty({ ...draft, questions: [{ ...first, bpm: 90 }, first] })).toBe(true);
  });

  it('is false once anything is typed or chosen', () => {
    const draft = emptyDraft();
    const [first] = draft.questions;
    if (first === undefined) throw new Error('Expected a question');
    const withQuestion = (q: Partial<typeof first>): QuizDraft => ({
      ...draft,
      questions: [{ ...first, ...q } as typeof first],
    });

    expect(isDraftEmpty({ ...draft, label: 'Title' })).toBe(false);
    expect(isDraftEmpty({ ...draft, description: 'About' })).toBe(false);
    expect(isDraftEmpty(withQuestion({ prompt: 'Is this S3?' }))).toBe(false);
    expect(isDraftEmpty(withQuestion({ soundSet: 's3-gallop' }))).toBe(false);
    expect(isDraftEmpty(withQuestion({ explanation: 'Why' }))).toBe(false);
  });

  it('is false when a multiple-choice question has a choice typed', () => {
    const draft: QuizDraft = {
      label: '',
      description: '',
      questions: [
        {
          key: 'm',
          type: 'multiple-choice',
          prompt: '',
          soundSet: '',
          bpm: 72,
          explanation: '',
          choices: [
            { key: 'a', label: '' },
            { key: 'b', label: 'Murmur' },
          ],
          answerKey: 'a',
        },
      ],
    };
    expect(isDraftEmpty(draft)).toBe(false);
  });
});

describe('findQuiz', () => {
  beforeEach(() => {
    useUploadedQuizStore.setState({ quizzes: [uploaded] });
  });

  it('finds built-in and uploaded quizzes by id', () => {
    const builtIn = PRESET_QUIZZES[0];
    expect(findQuiz(builtIn?.id ?? null)).toBe(builtIn);
    expect(findQuiz('my-upload')).toEqual(uploaded);
  });

  it('returns null for no id or an unknown id', () => {
    expect(findQuiz(null)).toBeNull();
    expect(findQuiz('nope')).toBeNull();
  });
});
