import { RotateCcw } from 'lucide-react';
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
import { AnswerReview, type ReviewItem } from './AnswerReview';

interface QuizResultsProps {
  /** What the learner answered for each question, keyed by question id. */
  answers: Record<string, boolean>;
  /** Called when the learner restarts, so the page can clear its answers. */
  onRestart: () => void;
}

export function QuizResults({ answers, onRestart }: QuizResultsProps) {
  const quiz = useQuizStore((s) => s.quiz);
  const restart = useQuizStore((s) => s.restart);
  const exitQuiz = useQuizStore((s) => s.exitQuiz);

  if (quiz === null) return null;

  const items: ReviewItem[] = quiz.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    selected: answers[q.id],
    correctAnswer: q.answer,
    explanation: q.explanation,
  }));

  const total = items.length;
  const score = items.filter((item) => item.selected === item.correctAnswer).length;
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
        <AnswerReview items={items} />
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
