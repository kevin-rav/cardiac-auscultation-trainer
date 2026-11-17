import type { QuizIssue } from '../../store';

/** One line for a problem found in a quiz file, as shown after an upload. */
export function formatIssue(issue: QuizIssue): string {
  return issue.path === '' ? issue.message : `${issue.path}: ${issue.message}`;
}
