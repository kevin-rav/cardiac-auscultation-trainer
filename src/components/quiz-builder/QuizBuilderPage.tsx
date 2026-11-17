import { useRef, useState, type ChangeEvent } from 'react';
import { Download, FolderOpen, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadTextFile } from '../../lib/downloadFile';
import {
  MAX_QUIZ_FILE_BYTES,
  draftToJson,
  draftToQuiz,
  parseQuizFile,
  useQuizBuilderStore,
  validateDraft,
  type Quiz,
  type QuizIssue,
} from '../../store';
import { formatIssue } from '../quiz/formatIssue';
import { findChoiceIssues } from './choiceIssues';
import { describeIssue } from './describeIssue';
import { fieldClass, labelClass } from './fieldStyles';
import { EDIT_PARAM, findQuiz, isDraftEmpty, openInBuilder } from './openInBuilder';
import { QuestionEditor } from './QuestionEditor';

/** Drop `?edit=…` from the address so a reload does not ask again. */
function clearEditParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(EDIT_PARAM)) return;
  url.searchParams.delete(EDIT_PARAM);
  window.history.replaceState(window.history.state, '', url);
}

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
  const fileRef = useRef<HTMLInputElement>(null);

  // A quiz waiting to replace a draft that has work in it. The Quiz page's Edit
  // button sends one here as `?edit=<id>` when the draft is not empty.
  const [pending, setPending] = useState<Quiz | null>(() =>
    findQuiz(new URLSearchParams(window.location.search).get(EDIT_PARAM)),
  );
  const [openErrors, setOpenErrors] = useState<QuizIssue[] | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  const open = (quiz: Quiz) => {
    openInBuilder(quiz);
    setPending(null);
    setOpenErrors(null);
    setConfirmingReset(false);
    setOpened(useQuizBuilderStore.getState().draft.label);
    clearEditParam();
  };

  const handleFile = async (file: File) => {
    setOpened(null);
    if (file.size > MAX_QUIZ_FILE_BYTES) {
      setOpenErrors([{ path: '', message: 'The file is larger than 1 MB' }]);
      return;
    }
    const parsed = parseQuizFile(await file.text());
    if (!parsed.success) {
      setOpenErrors(parsed.errors);
      return;
    }
    setOpenErrors(null);
    if (isDraftEmpty(useQuizBuilderStore.getState().draft)) open(parsed.quiz);
    else setPending(parsed.quiz);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so picking the same file again still fires a change.
    e.target.value = '';
    if (file) void handleFile(file);
  };

  // The same rules an upload of the downloaded file would face, plus choice
  // checks that only matter while writing (see findChoiceIssues).
  const result = validateDraft(draft);
  const issues = [...(result.success ? [] : result.errors), ...findChoiceIssues(draft)];
  const warnings = result.success ? result.warnings : [];
  const ready = result.success && issues.length === 0;

  const handleDownload = () => {
    downloadTextFile(`${draftToQuiz(draft).id}.json`, draftToJson(draft));
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Quiz Builder</h1>
          <p className="text-sm text-muted-foreground">
            Write a quiz, then download it as a file. Your draft is saved in this browser as you
            type.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <FolderOpen aria-hidden />
          Open quiz (.json)
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          aria-label="Quiz file to open"
          className="hidden"
          onChange={handleFileChange}
        />
      </header>

      {pending !== null && (
        <div
          role="group"
          aria-label="Confirm replace draft"
          className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm"
        >
          <p>
            Replace your current draft with <strong>{pending.label}</strong>? Your draft will be
            erased.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPending(null);
                clearEditParam();
              }}
            >
              Keep my draft
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                open(pending);
              }}
            >
              Replace draft
            </Button>
          </div>
        </div>
      )}

      {openErrors !== null && (
        <div
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p className="font-semibold">Could not open this quiz:</p>
          <ul className="list-disc pl-5">
            {openErrors.map((issue) => (
              <li key={formatIssue(issue)}>{formatIssue(issue)}</li>
            ))}
          </ul>
        </div>
      )}

      {opened !== null && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          Opened <strong>{opened}</strong>. Download it again when you are done editing.
        </p>
      )}

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

      <div className="flex flex-wrap gap-2">
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
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            addQuestion('multiple-choice');
          }}
        >
          <Plus aria-hidden />
          Add multiple-choice question
        </Button>
      </div>

      <div
        role="status"
        className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm"
      >
        {ready ? (
          <>
            <p className="font-semibold">Ready to download</p>
            {warnings.map((warning) => (
              <p key={warning.message} className="text-muted-foreground">
                Note: {warning.message}
              </p>
            ))}
          </>
        ) : (
          <>
            <p className="font-semibold">Before you can download:</p>
            <ul className="list-disc pl-5">
              {issues.map((issue, index) => (
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

        <Button type="button" disabled={!ready} onClick={handleDownload}>
          <Download aria-hidden />
          Download quiz
        </Button>
      </div>
    </main>
  );
}
