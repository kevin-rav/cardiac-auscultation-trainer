import { describe, expect, it } from 'vitest';
import { validateQuiz } from './quizValidation';

const knownSoundSets = new Set(['s3-gallop', 's4-gallop', 'normal-s1-s2']);

function question(id: string, soundSet: string, answer: boolean) {
  return {
    id,
    type: 'yes-no',
    prompt: 'Is this an S3 gallop?',
    sound: { soundSet },
    answer,
  };
}

function quiz(questions: unknown[]) {
  return { id: 'test-quiz', label: 'Test Quiz', questions };
}

describe('validateQuiz', () => {
  it('accepts a valid quiz and applies schema defaults', () => {
    const result = validateQuiz(
      quiz([question('q1', 's3-gallop', true), question('q2', 's4-gallop', false)]),
      knownSoundSets,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.warnings).toEqual([]);
    expect(result.quiz.questions[0]?.sound.bpm).toBe(72);
  });

  it('reports schema errors with a dot path to the field', () => {
    const result = validateQuiz(
      quiz([{ ...question('q1', 's3-gallop', true), prompt: '' }]),
      knownSoundSets,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.map((error) => error.path)).toEqual(['questions.0.prompt']);
  });

  it('rejects input that is not a quiz at all', () => {
    const result = validateQuiz('not a quiz', knownSoundSets);
    expect(result.success).toBe(false);
  });

  it('reports a sound set that does not exist', () => {
    const result = validateQuiz(
      quiz([question('q1', 's3-gallop', true), question('q2', 's5-gallop', false)]),
      knownSoundSets,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([
      { path: 'questions.1.sound.soundSet', message: 'Unknown sound set "s5-gallop"' },
    ]);
  });

  it('reports a duplicate question id at the second occurrence', () => {
    const result = validateQuiz(
      quiz([question('q1', 's3-gallop', true), question('q1', 's4-gallop', false)]),
      knownSoundSets,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([
      { path: 'questions.1.id', message: 'Duplicate question id "q1"' },
    ]);
  });

  it('reports every cross-reference error at once', () => {
    const result = validateQuiz(
      quiz([question('q1', 'missing-a', true), question('q1', 'missing-b', false)]),
      knownSoundSets,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toHaveLength(3);
  });

  it.each([
    [true, 'yes'],
    [false, 'no'],
  ])('warns when every answer is %s', (answer, word) => {
    const result = validateQuiz(
      quiz([question('q1', 's3-gallop', answer), question('q2', 's4-gallop', answer)]),
      knownSoundSets,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.warnings).toEqual([
      {
        path: 'questions',
        message: `Every answer is "${word}", so the quiz can be passed without listening`,
      },
    ]);
  });

  it('does not warn about a single-question quiz', () => {
    const result = validateQuiz(quiz([question('q1', 's3-gallop', true)]), knownSoundSets);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.warnings).toEqual([]);
  });

  describe('multiple-choice questions', () => {
    function mcq(id: string, answer: string, choiceIds: string[] = ['s3', 's4']) {
      return {
        id,
        type: 'multiple-choice',
        prompt: 'Which sound is this?',
        sound: { soundSet: 's3-gallop' },
        choices: choiceIds.map((choiceId) => ({ id: choiceId, label: choiceId.toUpperCase() })),
        answer,
      };
    }

    it('accepts a valid multiple-choice question', () => {
      expect(validateQuiz(quiz([mcq('m1', 's3')]), knownSoundSets).success).toBe(true);
    });

    it('reports a duplicate choice id', () => {
      const result = validateQuiz(quiz([mcq('m1', 's3', ['s3', 's3'])]), knownSoundSets);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors).toEqual([
        { path: 'questions.0.choices.1.id', message: 'Duplicate choice id "s3"' },
      ]);
    });

    it('reports an answer that is not one of the choices', () => {
      const result = validateQuiz(quiz([mcq('m1', 'normal')]), knownSoundSets);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors).toEqual([
        { path: 'questions.0.answer', message: 'Answer "normal" is not one of the choices' },
      ]);
    });

    it('does not count multiple-choice answers toward the same-answer warning', () => {
      const oneYesNo = validateQuiz(
        quiz([question('q1', 's3-gallop', true), mcq('m1', 's3'), mcq('m2', 's3')]),
        knownSoundSets,
      );
      expect(oneYesNo.success && oneYesNo.warnings).toEqual([]);

      const twoYes = validateQuiz(
        quiz([
          question('q1', 's3-gallop', true),
          question('q2', 's4-gallop', true),
          mcq('m1', 's4'),
        ]),
        knownSoundSets,
      );
      expect(twoYes.success && twoYes.warnings).toHaveLength(1);
    });
  });
});
