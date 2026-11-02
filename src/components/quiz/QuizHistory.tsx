import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuizHistoryStore, type QuizAttempt } from '../../store';
import { formatAttemptDate } from './formatDate';

interface QuizHistoryProps {
  /** Called when the learner clicks an attempt to review it. */
  onSelect: (attempt: QuizAttempt) => void;
}

/** The learner's saved attempts on this device, newest first. */
export function QuizHistory({ onSelect }: QuizHistoryProps) {
  const attempts = useQuizHistoryStore((s) => s.attempts);
  const clearHistory = useQuizHistoryStore((s) => s.clearHistory);
  const [confirming, setConfirming] = useState(false);

  if (attempts.length === 0) return null;

  return (
    <section aria-labelledby="quiz-history-heading" className="space-y-2">
      <div className="flex min-h-9 items-center justify-between gap-2">
        <h2 id="quiz-history-heading" className="text-base font-semibold">
          Previous attempts
        </h2>

        {confirming ? (
          <div role="group" aria-label="Confirm clear history" className="flex items-center gap-2">
            <span className="text-sm">Delete all {attempts.length} saved attempts?</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setConfirming(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                clearHistory();
                setConfirming(false);
              }}
            >
              Delete all
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setConfirming(true);
            }}
          >
            Clear history
          </Button>
        )}
      </div>

      <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {attempts.map((attempt, index) => (
          <li key={`${String(attempt.finishedAt)}-${String(index)}`}>
            <button
              type="button"
              aria-label={`Review attempt: ${attempt.quizLabel}, ${formatAttemptDate(attempt.finishedAt)}, ${String(attempt.score)} of ${String(attempt.total)} correct`}
              onClick={() => {
                onSelect(attempt);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{attempt.quizLabel}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatAttemptDate(attempt.finishedAt)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge variant="secondary">
                  {`${String(attempt.score)}/${String(attempt.total)}`}
                </Badge>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
