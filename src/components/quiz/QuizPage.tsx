import { useEffect, useState } from 'react';
import { PRESET_QUIZZES } from '../../data';
import { useQuizHistoryStore, useQuizStore, type QuizAnswer, type QuizAttempt } from '../../store';
import { QuizAttemptReview } from './QuizAttemptReview';
import { QuizCard } from './QuizCard';
import { QuizHistory } from './QuizHistory';
import { QuizQuestion } from './QuizQuestion';
import { QuizResults } from './QuizResults';
import { UploadedQuizzes } from './UploadedQuizzes';

/**
 * Quiz mode. Shows the quiz picker, then the current question, then the results.
 * All quiz logic and audio playback live in `useQuizStore`; finished attempts are
 * saved on this device by `useQuizHistoryStore`.
 */
export function QuizPage() {
  const quiz = useQuizStore((s) => s.quiz);
  const isFinished = useQuizStore((s) => s.isFinished);
  const startQuiz = useQuizStore((s) => s.startQuiz);
  const addAttempt = useQuizHistoryStore((s) => s.addAttempt);

  // The store does not keep a score, so the page remembers what the learner
  // answered for each question, keyed by question id.
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});

  // A saved attempt the learner opened from the history list, if any.
  const [reviewing, setReviewing] = useState<QuizAttempt | null>(null);

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

  const recordAnswer = (questionId: string, selected: QuizAnswer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: selected }));
  };

  // Called when the learner finishes the last question. Saves the attempt once.
  const handleFinish = () => {
    if (quiz === null) return;

    const recorded = quiz.questions.flatMap((q) => {
      const selected = answers[q.id];
      return selected === undefined
        ? []
        : [
            {
              questionId: q.id,
              prompt: q.prompt,
              selected,
              correctAnswer: q.answer,
              explanation: q.explanation,
              ...(q.type === 'multiple-choice' ? { choices: q.choices } : {}),
            },
          ];
    });

    addAttempt({
      quizId: quiz.id,
      quizLabel: quiz.label,
      finishedAt: Date.now(),
      score: recorded.filter((a) => a.selected === a.correctAnswer).length,
      total: quiz.questions.length,
      answers: recorded,
    });
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      {quiz === null && reviewing !== null ? (
        <QuizAttemptReview
          attempt={reviewing}
          onBack={() => {
            setReviewing(null);
          }}
        />
      ) : quiz === null ? (
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
                <QuizCard quiz={q} onStart={handleStart} />
              </li>
            ))}
          </ul>

          <UploadedQuizzes onStart={handleStart} />

          <QuizHistory onSelect={setReviewing} />
        </>
      ) : isFinished ? (
        <QuizResults
          answers={answers}
          onRestart={() => {
            setAnswers({});
          }}
        />
      ) : (
        <QuizQuestion onRecord={recordAnswer} onFinish={handleFinish} />
      )}
    </main>
  );
}
