import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface ReviewItem {
  id: string;
  prompt: string;
  /** What the learner answered, or undefined if they did not answer. */
  selected: boolean | undefined;
  correctAnswer: boolean;
  explanation: string | undefined;
}

interface AnswerReviewProps {
  items: readonly ReviewItem[];
}

const yesNo = (value: boolean): string => (value ? 'Yes' : 'No');

/** Each question with the learner's answer, the correct answer and the explanation. */
export function AnswerReview({ items }: AnswerReviewProps) {
  return (
    <ol className="flex flex-col gap-4">
      {items.map((item) => {
        const ok = item.selected === item.correctAnswer;
        return (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            {ok ? (
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Correct" />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Incorrect" />
            )}
            <div className="space-y-0.5">
              <p className="font-medium">{item.prompt}</p>
              <div className="flex flex-wrap gap-1.5 py-0.5">
                <Badge variant={ok ? 'secondary' : 'destructive'}>
                  Your answer: {item.selected === undefined ? 'None' : yesNo(item.selected)}
                </Badge>
                {!ok && (
                  <Badge variant="outline">Correct answer: {yesNo(item.correctAnswer)}</Badge>
                )}
              </div>
              {item.explanation !== undefined && (
                <p className="text-muted-foreground">{item.explanation}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
