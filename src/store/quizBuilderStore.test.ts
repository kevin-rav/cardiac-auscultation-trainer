import { beforeEach, describe, expect, it } from 'vitest';
import { PRESET_QUIZZES } from '../data';
import { validateDraft, type DraftQuestion } from './quizDraft';
import { emptyDraft, QUIZ_DRAFT_STORAGE_KEY, useQuizBuilderStore } from './quizBuilderStore';

const store = () => useQuizBuilderStore.getState();
const questions = () => store().draft.questions;

function question(index: number): DraftQuestion {
  const q = questions()[index];
  if (!q) throw new Error(`No question at ${String(index)}`);
  return q;
}

function multipleChoice(index: number) {
  const q = question(index);
  if (q.type !== 'multiple-choice') throw new Error('Expected a multiple-choice question');
  return q;
}

describe('quizBuilderStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useQuizBuilderStore.setState({ draft: emptyDraft() });
  });

  it('starts with one blank yes-no question and no sound chosen', () => {
    expect(questions()).toHaveLength(1);
    expect(question(0)).toMatchObject({ type: 'yes-no', prompt: '', soundSet: '', bpm: 72 });
  });

  it('sets the title and description', () => {
    store().setLabel('Gallops');
    store().setDescription('S3 and S4');
    expect(store().draft).toMatchObject({ label: 'Gallops', description: 'S3 and S4' });
  });

  describe('questions', () => {
    it('adds questions of either type', () => {
      store().addQuestion('multiple-choice');
      expect(questions().map((q) => q.type)).toEqual(['yes-no', 'multiple-choice']);
      expect(multipleChoice(1).choices).toHaveLength(2);
      expect(multipleChoice(1).answerKey).toBe(multipleChoice(1).choices[0]?.key);
    });

    it('updates the shared fields of one question', () => {
      store().addQuestion('yes-no');
      store().updateQuestion(question(1).key, {
        prompt: 'Is this an S4?',
        soundSet: 's4-gallop',
        bpm: 90,
      });
      expect(question(1)).toMatchObject({
        prompt: 'Is this an S4?',
        soundSet: 's4-gallop',
        bpm: 90,
      });
      expect(question(0).prompt).toBe('');
    });

    it('sets the yes-no answer', () => {
      store().setYesNoAnswer(question(0).key, false);
      expect(question(0)).toMatchObject({ answer: false });
    });

    it('switches type and keeps the prompt, sound and explanation', () => {
      const { key } = question(0);
      store().updateQuestion(key, { prompt: 'Which?', soundSet: 's3-gallop', explanation: 'Why' });

      store().setQuestionType(key, 'multiple-choice');
      expect(question(0)).toMatchObject({
        key,
        type: 'multiple-choice',
        prompt: 'Which?',
        soundSet: 's3-gallop',
        explanation: 'Why',
      });

      store().setQuestionType(key, 'yes-no');
      expect(question(0)).toMatchObject({ key, type: 'yes-no', prompt: 'Which?', answer: true });
    });

    it('moves a question and ignores moves past either end', () => {
      store().addQuestion('multiple-choice');
      const [first, second] = questions().map((q) => q.key);

      store().moveQuestion(first ?? '', 1);
      expect(questions().map((q) => q.key)).toEqual([second, first]);

      store().moveQuestion(first ?? '', 1);
      store().moveQuestion(second ?? '', -1);
      expect(questions().map((q) => q.key)).toEqual([second, first]);
    });

    it('removes a question', () => {
      store().addQuestion('multiple-choice');
      store().removeQuestion(question(0).key);
      expect(questions().map((q) => q.type)).toEqual(['multiple-choice']);
    });
  });

  describe('choices', () => {
    beforeEach(() => {
      store().setQuestionType(question(0).key, 'multiple-choice');
    });

    it('adds and renames choices', () => {
      const { key } = question(0);
      store().addChoice(key);
      const third = multipleChoice(0).choices[2]?.key ?? '';
      store().updateChoice(key, third, 'Normal S1-S2');
      expect(multipleChoice(0).choices.map((c) => c.label)).toEqual(['', '', 'Normal S1-S2']);
    });

    it('sets the correct choice, ignoring unknown keys', () => {
      const { key } = question(0);
      const second = multipleChoice(0).choices[1]?.key ?? '';
      store().setCorrectChoice(key, second);
      store().setCorrectChoice(key, 'missing');
      expect(multipleChoice(0).answerKey).toBe(second);
    });

    it('moves the answer to the first remaining choice when the correct one is removed', () => {
      const { key } = question(0);
      const [first, second] = multipleChoice(0).choices.map((c) => c.key);
      store().setCorrectChoice(key, second ?? '');
      store().removeChoice(key, second ?? '');
      expect(multipleChoice(0).answerKey).toBe(first);
    });

    it('ignores choice actions on a yes-no question', () => {
      store().addQuestion('yes-no');
      const yesNo = question(1);
      store().addChoice(yesNo.key);
      expect(question(1)).toEqual(yesNo);
    });
  });

  describe('loading and resetting', () => {
    it('loads an existing quiz as a draft that validates', () => {
      const quiz = PRESET_QUIZZES.find((q) =>
        q.questions.some((x) => x.type === 'multiple-choice'),
      );
      expect(quiz).toBeDefined();
      if (!quiz) return;

      store().loadQuiz(quiz);
      expect(store().draft.label).toBe(quiz.label);
      expect(questions()).toHaveLength(quiz.questions.length);
      // Built-in ids are reserved, so only that rule should fail.
      const result = validateDraft(store().draft);
      expect(result.success ? [] : result.errors.map((e) => e.path)).toEqual(['id']);
    });

    it('resets to a blank draft', () => {
      store().setLabel('Something');
      store().reset();
      expect(store().draft).toMatchObject({ label: '', description: '' });
      expect(questions()).toHaveLength(1);
    });
  });

  describe('autosave', () => {
    it('saves the draft to localStorage', () => {
      store().setLabel('Autosaved Quiz');
      expect(localStorage.getItem(QUIZ_DRAFT_STORAGE_KEY)).toContain('"label":"Autosaved Quiz"');
    });

    it('restores a saved draft', async () => {
      store().setLabel('Restored Quiz');
      store().addQuestion('multiple-choice');
      const saved = store().draft;
      const raw = localStorage.getItem(QUIZ_DRAFT_STORAGE_KEY) ?? '';
      // Clearing the in-memory draft autosaves too, so put the saved copy back.
      useQuizBuilderStore.setState({ draft: emptyDraft() });
      localStorage.setItem(QUIZ_DRAFT_STORAGE_KEY, raw);

      await useQuizBuilderStore.persist.rehydrate();
      expect(store().draft).toEqual(saved);
    });

    it('discards a saved draft with the wrong shape', async () => {
      // Set the current draft first: setState autosaves and would overwrite the bad data.
      useQuizBuilderStore.setState({ draft: { ...emptyDraft(), label: 'Current' } });
      localStorage.setItem(
        QUIZ_DRAFT_STORAGE_KEY,
        JSON.stringify({ state: { draft: { label: 42 } }, version: 1 }),
      );

      await useQuizBuilderStore.persist.rehydrate();
      expect(store().draft.label).toBe('Current');
    });
  });
});
