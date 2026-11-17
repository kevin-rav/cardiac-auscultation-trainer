import { describe, expect, it } from 'vitest';
import type { QuizDraft } from '../../store';
import { findChoiceIssues } from './choiceIssues';

function draftWithChoices(...questions: string[][]): QuizDraft {
  return {
    label: 'Test',
    description: '',
    questions: questions.map((labels, i) => ({
      key: `q${String(i)}`,
      type: 'multiple-choice',
      prompt: 'Which sound?',
      soundSet: 'normal-s1-s2',
      bpm: 72,
      explanation: '',
      choices: labels.map((label, j) => ({ key: `c${String(j)}`, label })),
      answerKey: 'c0',
    })),
  };
}

describe('findChoiceIssues', () => {
  it('finds nothing wrong with distinct labels', () => {
    expect(findChoiceIssues(draftWithChoices(['Normal', 'Murmur', 'S3']))).toEqual([]);
  });

  it('flags a label that repeats an earlier one, ignoring case and spaces', () => {
    expect(findChoiceIssues(draftWithChoices(['S3 gallop', 'Normal', ' s3   GALLOP ']))).toEqual([
      { path: 'questions.0.choices.2.duplicate', message: 'Same label as another choice' },
    ]);
  });

  it('flags a label made only of spaces but leaves empty ones to the validator', () => {
    expect(findChoiceIssues(draftWithChoices(['', '  ', 'Normal']))).toEqual([
      { path: 'questions.0.choices.1.label', message: 'Blank label' },
    ]);
  });

  it('checks each question on its own and skips yes/no questions', () => {
    const draft = draftWithChoices(['Normal', 'Murmur'], ['Normal', 'Murmur']);
    draft.questions.push({
      key: 'yn',
      type: 'yes-no',
      prompt: 'Is this normal?',
      soundSet: 'normal-s1-s2',
      bpm: 72,
      explanation: '',
      answer: true,
    });
    expect(findChoiceIssues(draft)).toEqual([]);
  });
});
