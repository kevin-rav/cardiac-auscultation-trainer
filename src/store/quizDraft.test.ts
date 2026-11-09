import { describe, expect, it } from 'vitest';
import { PRESET_QUIZZES } from '../data';
import { QuizSchema } from '../engine/schema';
import {
  draftToJson,
  draftToQuiz,
  quizToDraft,
  slugify,
  validateDraft,
  type QuizDraft,
} from './quizDraft';

function keyMaker(): () => string {
  let n = 0;
  return () => `k${String((n += 1))}`;
}

const draft: QuizDraft = {
  label: 'My Gallops Quiz!',
  description: '',
  questions: [
    {
      key: 'a',
      type: 'yes-no',
      prompt: 'Is this an S3 gallop?',
      soundSet: 's3-gallop',
      bpm: 72,
      explanation: '  ',
      answer: true,
    },
    {
      key: 'b',
      type: 'multiple-choice',
      prompt: 'Which sound is this?',
      soundSet: 's4-gallop',
      bpm: 90,
      explanation: 'Just before S1.',
      choices: [
        { key: 'c1', label: 'S3 gallop' },
        { key: 'c2', label: 'S4 gallop' },
      ],
      answerKey: 'c2',
    },
  ],
};

describe('slugify', () => {
  it.each([
    ['My Gallops Quiz!', 'my-gallops-quiz'],
    ['  Normal S1–S2  ', 'normal-s1-s2'],
    ['!!!', ''],
  ])('turns %j into %j', (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });
});

describe('draftToQuiz', () => {
  it('generates ids and omits blank optional text', () => {
    expect(draftToQuiz(draft)).toEqual({
      id: 'my-gallops-quiz',
      label: 'My Gallops Quiz!',
      questions: [
        {
          id: 'q1',
          type: 'yes-no',
          prompt: 'Is this an S3 gallop?',
          sound: { soundSet: 's3-gallop', bpm: 72 },
          answer: true,
        },
        {
          id: 'q2',
          type: 'multiple-choice',
          prompt: 'Which sound is this?',
          sound: { soundSet: 's4-gallop', bpm: 90 },
          explanation: 'Just before S1.',
          choices: [
            { id: 's3-gallop', label: 'S3 gallop' },
            { id: 's4-gallop', label: 'S4 gallop' },
          ],
          answer: 's4-gallop',
        },
      ],
    });
  });

  it('falls back to positional choice ids for blank or repeated labels', () => {
    const quiz = draftToQuiz({
      ...draft,
      questions: [
        {
          key: 'm',
          type: 'multiple-choice',
          prompt: 'Which?',
          soundSet: 's3-gallop',
          bpm: 72,
          explanation: '',
          choices: [
            { key: 'x', label: 'Gallop' },
            { key: 'y', label: 'gallop' },
            { key: 'z', label: '' },
          ],
          answerKey: 'y',
        },
      ],
    });
    const question = quiz.questions[0];
    expect(question?.type === 'multiple-choice' && question.choices.map((c) => c.id)).toEqual([
      'gallop',
      'choice-2',
      'choice-3',
    ]);
    expect(question?.answer).toBe('choice-2');
  });

  it('names an untitled quiz', () => {
    expect(draftToQuiz({ ...draft, label: '' }).id).toBe('untitled-quiz');
  });

  it('produces JSON that the quiz schema accepts', () => {
    expect(QuizSchema.safeParse(JSON.parse(draftToJson(draft))).success).toBe(true);
  });
});

describe('validateDraft', () => {
  it('accepts a complete draft', () => {
    expect(validateDraft(draft).success).toBe(true);
  });

  it('reports blank fields with the path of the question', () => {
    const result = validateDraft({
      ...draft,
      questions: [
        {
          key: 'a',
          type: 'yes-no',
          prompt: '',
          soundSet: 's3-gallop',
          bpm: 72,
          explanation: '',
          answer: true,
        },
      ],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.map((e) => e.path)).toContain('questions.0.prompt');
  });

  it('uses the upload rules, including the built-in quiz id check', () => {
    const builtIn = PRESET_QUIZZES[0];
    expect(builtIn).toBeDefined();
    if (!builtIn) return;

    const result = validateDraft({ ...draft, label: builtIn.id });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0]?.path).toBe('id');
  });
});

describe('quizToDraft', () => {
  it.each(PRESET_QUIZZES.map((quiz) => [quiz.id, quiz] as const))(
    'round-trips the %s quiz through the builder unchanged except for ids',
    (_id, quiz) => {
      const roundTrip = QuizSchema.parse(draftToQuiz(quizToDraft(quiz, keyMaker())));

      expect(roundTrip.label).toBe(quiz.label);
      expect(roundTrip.description).toBe(quiz.description);
      roundTrip.questions.forEach((question, index) => {
        const original = quiz.questions[index];
        expect(original).toBeDefined();
        if (!original) return;
        expect(question.type).toBe(original.type);
        expect(question.prompt).toBe(original.prompt);
        expect(question.sound).toEqual(original.sound);
        expect(question.explanation).toBe(original.explanation);
        if (question.type === 'multiple-choice' && original.type === 'multiple-choice') {
          expect(question.choices.map((c) => c.label)).toEqual(
            original.choices.map((c) => c.label),
          );
          const label = (q: typeof question) => q.choices.find((c) => c.id === q.answer)?.label;
          expect(label(question)).toBe(label(original));
        } else {
          expect(question.answer).toBe(original.answer);
        }
      });
    },
  );
});
