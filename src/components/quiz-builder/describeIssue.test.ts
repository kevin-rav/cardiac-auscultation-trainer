import { describe, expect, it } from 'vitest';
import { describeIssue } from './describeIssue';

describe('describeIssue', () => {
  it('asks for a title', () => {
    expect(describeIssue({ path: 'label', message: 'Too small' })).toBe('Give the quiz a title');
  });

  it('explains a title that matches a built-in quiz', () => {
    expect(describeIssue({ path: 'id', message: 'used by a built-in quiz' })).toBe(
      'This title matches a built-in quiz. Choose a different title',
    );
  });

  it('asks for at least one question', () => {
    expect(describeIssue({ path: 'questions', message: 'Too small' })).toBe(
      'Add at least one question',
    );
  });

  it('numbers questions from 1 and names the missing field', () => {
    expect(describeIssue({ path: 'questions.0.prompt', message: 'Too small' })).toBe(
      'Question 1: write the question',
    );
    expect(describeIssue({ path: 'questions.2.sound.soundSet', message: 'Invalid' })).toBe(
      'Question 3: choose a sound',
    );
    expect(describeIssue({ path: 'questions.1.sound.bpm', message: 'Too big' })).toBe(
      'Question 2: heart rate must be between 30 and 220 BPM',
    );
  });

  it('falls back to the validator message for other fields', () => {
    expect(describeIssue({ path: 'questions.0.answer', message: 'Not one of the choices' })).toBe(
      'Question 1: Not one of the choices',
    );
    expect(describeIssue({ path: 'description', message: 'Odd' })).toBe('Odd');
  });
});
