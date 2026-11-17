import { Download, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { downloadTextFile } from '../../lib/downloadFile';
import type { Quiz } from '../../store';

interface QuizCardProps {
  quiz: Quiz;
  onStart: (id: string) => void;
  /** Opens the quiz in the builder. Without it, there is no Edit button. */
  onEdit?: ((quiz: Quiz) => void) | undefined;
  /** Extra buttons shown next to Start, such as Remove for uploaded quizzes. */
  actions?: ReactNode;
}

export function QuizCard({ quiz, onStart, onEdit, actions }: QuizCardProps) {
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
      <CardContent className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            onStart(quiz.id);
          }}
          aria-label={`Start quiz: ${quiz.label}`}
        >
          Start quiz
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            downloadTextFile(`${quiz.id}.json`, `${JSON.stringify(quiz, null, 2)}\n`);
          }}
          aria-label={`Download quiz: ${quiz.label}`}
        >
          <Download aria-hidden="true" />
          Download
        </Button>
        {onEdit !== undefined && (
          <Button
            variant="outline"
            onClick={() => {
              onEdit(quiz);
            }}
            aria-label={`Edit quiz: ${quiz.label}`}
          >
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        )}
        {actions}
      </CardContent>
    </Card>
  );
}
