import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { QuizAttempt } from '../../store';
import { AnswerReview, type ReviewItem } from './AnswerReview';
import { formatAttemptDate } from './formatDate';

interface QuizAttemptReviewProps {
  attempt: QuizAttempt;
  onBack: () => void;
}

/** Read-only review of one saved attempt, for debriefing with an instructor. */
export function QuizAttemptReview({ attempt, onBack }: QuizAttemptReviewProps) {
  const items: ReviewItem[] = attempt.answers.map((a) => ({
    id: a.questionId,
    prompt: a.prompt,
    selected: a.selected,
    correctAnswer: a.correctAnswer,
    explanation: a.explanation,
  }));
  const percent = Math.round((attempt.score / attempt.total) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold">{attempt.quizLabel} review</h1>
        </CardTitle>
        <CardDescription>
          {formatAttemptDate(attempt.finishedAt)}
          <br />
          <span className="text-2xl font-bold text-foreground">
            {attempt.score} of {attempt.total} correct
          </span>{' '}
          ({percent}%)
        </CardDescription>
      </CardHeader>

      <CardContent>
        <AnswerReview items={items} />
      </CardContent>

      <CardFooter>
        <Button type="button" variant="ghost" onClick={onBack}>
          Back to quizzes
        </Button>
      </CardFooter>
    </Card>
  );
}
