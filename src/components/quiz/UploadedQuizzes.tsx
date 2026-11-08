import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  MAX_QUIZ_FILE_BYTES,
  parseQuizFile,
  useUploadedQuizStore,
  type QuizIssue,
} from '../../store';
import { QuizCard } from './QuizCard';

type UploadStatus =
  | { kind: 'success'; message: string; warnings: QuizIssue[] }
  | { kind: 'error'; errors: QuizIssue[] };

function formatIssue(issue: QuizIssue): string {
  return issue.path === '' ? issue.message : `${issue.path}: ${issue.message}`;
}

/** Upload quiz JSON files and list the quizzes saved in this browser. */
export function UploadedQuizzes({ onStart }: { onStart: (id: string) => void }) {
  const quizzes = useUploadedQuizStore((s) => s.quizzes);
  const addQuiz = useUploadedQuizStore((s) => s.addQuiz);
  const removeQuiz = useUploadedQuizStore((s) => s.removeQuiz);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus | null>(null);

  const handleFile = async (file: File) => {
    if (file.size > MAX_QUIZ_FILE_BYTES) {
      setStatus({ kind: 'error', errors: [{ path: '', message: 'The file is larger than 1 MB' }] });
      return;
    }
    const result = parseQuizFile(await file.text());
    if (!result.success) {
      setStatus({ kind: 'error', errors: result.errors });
      return;
    }
    const outcome = addQuiz(result.quiz);
    setStatus({
      kind: 'success',
      message: `${outcome === 'added' ? 'Added' : 'Updated'} "${result.quiz.label}"`,
      warnings: result.warnings,
    });
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so picking the same file again still fires a change.
    e.target.value = '';
    if (file) void handleFile(file);
  };

  return (
    <section aria-labelledby="uploaded-quizzes-heading" className="space-y-2">
      <div className="flex min-h-9 items-center justify-between gap-2">
        <h2 id="uploaded-quizzes-heading" className="text-base font-semibold">
          Uploaded quizzes
        </h2>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Upload quiz (.json)
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          aria-label="Quiz file"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {status?.kind === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p className="font-semibold">Could not upload this quiz:</p>
          <ul className="list-disc pl-5">
            {status.errors.map((issue) => (
              <li key={formatIssue(issue)}>{formatIssue(issue)}</li>
            ))}
          </ul>
        </div>
      )}

      {status?.kind === 'success' && (
        <div role="status" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p className="font-semibold">{status.message}</p>
          {status.warnings.map((issue) => (
            <p key={formatIssue(issue)} className="text-muted-foreground">
              Note: {issue.message}
            </p>
          ))}
        </div>
      )}

      {quizzes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Quizzes you upload are saved in this browser only.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {quizzes.map((q) => (
            <li key={q.id}>
              <QuizCard
                quiz={q}
                onStart={onStart}
                actions={
                  <Button
                    variant="outline"
                    onClick={() => {
                      removeQuiz(q.id);
                      setStatus(null);
                    }}
                    aria-label={`Remove uploaded quiz: ${q.label}`}
                  >
                    Remove
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
