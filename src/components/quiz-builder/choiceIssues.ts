import type { QuizDraft, QuizIssue } from '../../store';

/** How a learner reads a choice: case and extra spaces do not make two choices different. */
const normalize = (label: string): string => label.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Choice problems the quiz validator cannot see. The file format only needs
 * choice ids to differ, and the builder makes ids unique on export, so two
 * choices labelled "Murmur" would still pass. A learner could not tell them
 * apart, so the builder blocks them, and choices made only of spaces.
 *
 * Paths follow the validator's style so `describeIssue` can word them.
 */
export function findChoiceIssues(draft: QuizDraft): QuizIssue[] {
  const issues: QuizIssue[] = [];

  draft.questions.forEach((question, questionIndex) => {
    if (question.type !== 'multiple-choice') return;
    const seen = new Set<string>();

    question.choices.forEach((choice, choiceIndex) => {
      const path = `questions.${String(questionIndex)}.choices.${String(choiceIndex)}`;
      const label = normalize(choice.label);

      if (label === '') {
        // An empty box is already reported by the validator; only spaces slip through.
        if (choice.label !== '') issues.push({ path: `${path}.label`, message: 'Blank label' });
        return;
      }
      if (seen.has(label)) {
        issues.push({ path: `${path}.duplicate`, message: 'Same label as another choice' });
      }
      seen.add(label);
    });
  });

  return issues;
}
