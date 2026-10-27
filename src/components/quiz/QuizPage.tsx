import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PRESET_QUIZZES } from '../../data';
import { useQuizStore } from '../../store';
import { QuizQuestion } from './QuizQuestion';
import { QuizResults } from './QuizResults';

/**
 * Quiz mode. Shows the quiz picker, then the current question, then the results.
 * All quiz logic and audio playback live in `useQuizStore`; this is just the UI.
 */
export function QuizPage() {
  const quiz = useQuizStore((s) => s.quiz);
  const isFinished = useQuizStore((s) => s.isFinished);
  const startQuiz = useQuizStore((s) => s.startQuiz);

  // The store does not keep a score, so the page remembers what the learner
  // answered for each question, keyed by question id.
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  // Stop any playing sound and unload the quiz when leaving the page.
  useEffect(() => {
    return () => {
      useQuizStore.getState().exitQuiz();
    };
  }, []);

  const handleStart = (id: string) => {
    setAnswers({});
    startQuiz(id);
  };

  const recordAnswer = (questionId: string, selected: boolean) => {
    setAnswers((prev) => ({ ...prev, [questionId]: selected }));
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      {quiz === null ? (
        <>
          <header className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Quiz</h1>
            <p className="text-sm text-muted-foreground">
              Listen to a heart sound, then answer the question about it.
            </p>
          </header>

          <ul className="flex flex-col gap-4">
            {PRESET_QUIZZES.map((q) => (
              <li key={q.id}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>
                        <h2 className="text-base font-semibold">{q.label}</h2>
                      </CardTitle>
                      <Badge variant="secondary">{q.questions.length} questions</Badge>
                    </div>
                    {q.description !== undefined && (
                      <CardDescription>{q.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => {
                        handleStart(q.id);
                      }}
                      aria-label={`Start quiz: ${q.label}`}
                    >
                      Start quiz
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      ) : isFinished ? (
        <QuizResults
          answers={answers}
          onRestart={() => {
            setAnswers({});
          }}
        />
      ) : (
        <QuizQuestion onRecord={recordAnswer} />
      )}
    </main>
  );
}
