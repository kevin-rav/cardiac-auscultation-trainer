import { Check, RotateCcw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useQuizStore } from '../../store';

interface QuizResultsProps {
  /** What the learner answered for each question, keyed by question id. */
  answers: Record<string, boolean>;
  /** Called when the learner restarts, so the page can clear its answers. */
  onRestart: () => void;
}

const yesNo = (value: boolean): string => (value ? 'Yes' : 'No');

export function QuizResults({ answers, onRestart }: QuizResultsProps) {
  const quiz = useQuizStore((s) => s.quiz);
  const restart = useQuizStore((s) => s.restart);
  const exitQuiz = useQuizStore((s) => s.exitQuiz);

  if (quiz === null) return null;

  const total = quiz.questions.length;
  const score = quiz.questions.filter((q) => answers[q.id] === q.answer).length;
  const percent = Math.round((score / total) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold">{quiz.label} complete</h1>
        </CardTitle>
        <CardDescription>
          <span className="text-2xl font-bold text-foreground">
            {score} of {total} correct
          </span>{' '}
          ({percent}%)
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ol className="flex flex-col gap-4">
          {quiz.questions.map((q) => {
            const selected = answers[q.id];
            const ok = selected === q.answer;
            return (
              <li key={q.id} className="flex items-start gap-2 text-sm">
                {ok ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Correct" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Incorrect" />
                )}
                <div className="space-y-0.5">
                  <p className="font-medium">{q.prompt}</p>
                  <div className="flex flex-wrap gap-1.5 py-0.5">
                    <Badge variant={ok ? 'secondary' : 'destructive'}>
                      Your answer: {selected === undefined ? 'None' : yesNo(selected)}
                    </Badge>
                    {!ok && <Badge variant="outline">Correct answer: {yesNo(q.answer)}</Badge>}
                  </div>
                  {q.explanation !== undefined && (
                    <p className="text-muted-foreground">{q.explanation}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>

      <CardFooter className="justify-between">
        <Button type="button" variant="ghost" onClick={exitQuiz}>
          Back to quizzes
        </Button>
        <Button
          type="button"
          onClick={() => {
            onRestart();
            restart();
          }}
        >
          <RotateCcw aria-hidden />
          Try again
        </Button>
      </CardFooter>
    </Card>
  );
}
