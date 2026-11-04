import { describe, expect, it } from 'vitest';
import { PRESET_QUIZZES } from '../data';
import { parseQuizFile } from './parseQuizFile';

function quizJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'my-upload',
    label: 'My Upload',
    questions: [
      {
        id: 'q1',
        type: 'yes-no',
        prompt: 'Is this an S3 gallop?',
        sound: { soundSet: 's3-gallop' },
        answer: true,
      },
      {
        id: 'q2',
        type: 'yes-no',
        prompt: 'Is this an S3 gallop?',
        sound: { soundSet: 's4-gallop' },
        answer: false,
      },
    ],
    ...overrides,
  });
}

describe('parseQuizFile', () => {
  it('accepts a valid quiz file', () => {
    const result = parseQuizFile(quizJson());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.quiz.id).toBe('my-upload');
    expect(result.warnings).toEqual([]);
  });

  it('reports a file that is not JSON', () => {
    const result = parseQuizFile('{ not json');
    expect(result).toEqual({
      success: false,
      errors: [{ path: '', message: 'The file is not valid JSON' }],
    });
  });

  it('reports schema errors with their path', () => {
    const result = parseQuizFile(quizJson({ label: '' }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0]?.path).toBe('label');
  });

  it('reports a sound set that does not exist', () => {
    const result = parseQuizFile(
      quizJson({
        questions: [
          {
            id: 'q1',
            type: 'yes-no',
            prompt: 'Is this a gallop?',
            sound: { soundSet: 's5-gallop' },
            answer: true,
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([
      { path: 'questions.0.sound.soundSet', message: 'Unknown sound set "s5-gallop"' },
    ]);
  });

  it('rejects an id used by a built-in quiz', () => {
    const builtIn = PRESET_QUIZZES[0];
    expect(builtIn).toBeDefined();
    if (!builtIn) return;

    const result = parseQuizFile(quizJson({ id: builtIn.id }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0]?.path).toBe('id');
    expect(result.errors[0]?.message).toContain('built-in quiz');
  });

  it('passes validator warnings through on success', () => {
    const result = parseQuizFile(
      quizJson({
        questions: [
          {
            id: 'q1',
            type: 'yes-no',
            prompt: 'Is this an S3 gallop?',
            sound: { soundSet: 's3-gallop' },
            answer: true,
          },
          {
            id: 'q2',
            type: 'yes-no',
            prompt: 'Is this an S4 gallop?',
            sound: { soundSet: 's4-gallop' },
            answer: true,
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.warnings).toHaveLength(1);
  });
});
