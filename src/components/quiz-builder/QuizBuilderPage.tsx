import { useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadTextFile } from '../../lib/downloadFile';
import { draftToJson, draftToQuiz, useQuizBuilderStore, validateDraft } from '../../store';
import { describeIssue } from './describeIssue';
import { fieldClass, labelClass } from './fieldStyles';
import { QuestionEditor } from './QuestionEditor';

/**
 * Quiz builder. An instructor writes a quiz here and downloads it as a file
 * that can be uploaded on the Quiz page. The draft is saved in this browser.
 */
export function QuizBuilderPage() {
  const draft = useQuizBuilderStore((s) => s.draft);
  const setLabel = useQuizBuilderStore((s) => s.setLabel);
  const setDescription = useQuizBuilderStore((s) => s.setDescription);
  const addQuestion = useQuizBuilderStore((s) => s.addQuestion);
  const reset = useQuizBuilderStore((s) => s.reset);
  const [confirmingReset, setConfirmingReset] = useState(false);

  // The same rules an upload of the downloaded file would face.
  const result = validateDraft(draft);

  const handleDownload = () => {
    downloadTextFile(`${draftToQuiz(draft).id}.json`, draftToJson(draft));
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Quiz Builder</h1>
        <p className="text-sm text-muted-foreground">
          Write a quiz, then download it as a file. Your draft is saved in this browser as you type.
        </p>
      </header>

      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="quiz-title" className={labelClass}>
            Quiz title
          </label>
          <input
            id="quiz-title"
            type="text"
            className={fieldClass}
            placeholder="Identify Heart Sounds"
            value={draft.label}
            onChange={(e) => {
              setLabel(e.target.value);
            }}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="quiz-description" className={labelClass}>
            Description (optional)
          </label>
          <textarea
            id="quiz-description"
            rows={2}
            className={fieldClass}
            value={draft.description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-4">
        {draft.questions.map((question, index) => (
          <li key={question.key}>
            <QuestionEditor question={question} index={index} total={draft.questions.length} />
          </li>
        ))}
      </ol>

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          addQuestion('yes-no');
        }}
      >
        <Plus aria-hidden />
        Add yes/no question
      </Button>

      <div
        role="status"
        className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm"
      >
        {result.success ? (
          <>
            <p className="font-semibold">Ready to download</p>
            {result.warnings.map((warning) => (
              <p key={warning.message} className="text-muted-foreground">
                Note: {warning.message}
              </p>
            ))}
          </>
        ) : (
          <>
            <p className="font-semibold">Before you can download:</p>
            <ul className="list-disc pl-5">
              {result.errors.map((issue, index) => (
                <li key={`${String(index)}-${issue.path}`}>{describeIssue(issue)}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        {confirmingReset ? (
          <div role="group" aria-label="Confirm start over" className="flex items-center gap-2">
            <span className="text-sm">Erase this draft?</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setConfirmingReset(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                reset();
                setConfirmingReset(false);
              }}
            >
              Erase draft
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setConfirmingReset(true);
            }}
          >
            Start over
          </Button>
        )}

        <Button type="button" disabled={!result.success} onClick={handleDownload}>
          <Download aria-hidden />
          Download quiz
        </Button>
      </div>
    </main>
  );
}
