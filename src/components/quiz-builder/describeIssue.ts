import type { QuizIssue } from '../../store';

/**
 * Turn a validation problem into a plain sentence for the person building the
 * quiz. The validator reports field paths like "questions.0.sound.soundSet".
 */
export function describeIssue(issue: QuizIssue): string {
  const match = /^questions\.(\d+)\.(.+)$/.exec(issue.path);
  const index = match?.[1];
  const field = match?.[2];

  if (index === undefined || field === undefined) {
    switch (issue.path) {
      case 'label':
        return 'Give the quiz a title';
      case 'id':
        return 'This title matches a built-in quiz. Choose a different title';
      case 'questions':
        return 'Add at least one question';
      default:
        return issue.message;
    }
  }

  const prefix = `Question ${String(Number(index) + 1)}`;
  switch (field) {
    case 'prompt':
      return `${prefix}: write the question`;
    case 'sound.soundSet':
      return `${prefix}: choose a sound`;
    case 'sound.bpm':
      return `${prefix}: heart rate must be between 30 and 220 BPM`;
    default:
      return `${prefix}: ${issue.message}`;
  }
}
