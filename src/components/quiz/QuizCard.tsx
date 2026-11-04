import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Quiz } from '../../engine/schema';

interface QuizCardProps {
  quiz: Quiz;
  onStart: (id: string) => void;
  /** Extra buttons shown next to Start, such as Remove for uploaded quizzes. */
  actions?: ReactNode;
}

export function QuizCard({ quiz, onStart, actions }: QuizCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>
            <h2 className="text-base font-semibold">{quiz.label}</h2>
          </CardTitle>
          <Badge variant="secondary">{quiz.questions.length} questions</Badge>
        </div>
        {quiz.description !== undefined && <CardDescription>{quiz.description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          onClick={() => {
            onStart(quiz.id);
          }}
          aria-label={`Start quiz: ${quiz.label}`}
        >
          Start quiz
        </Button>
        {actions}
      </CardContent>
    </Card>
  );
}
