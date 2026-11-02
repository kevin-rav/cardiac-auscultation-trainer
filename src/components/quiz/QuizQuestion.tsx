import { Check, Play, Square, X } from 'lucide-react';
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
import { getCurrentQuestion, isAnswerCorrect, useQuizStore } from '../../store';

interface QuizQuestionProps {
  /** Called once per question with the learner's selected answer. */
  onRecord: (questionId: string, selected: boolean) => void;
  /** Called when the learner finishes the last question, before the results show. */
  onFinish: () => void;
}

const CORRECT_STYLE =
  'border-emerald-600 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-400';
const WRONG_STYLE = 'border-destructive bg-destructive/10 text-destructive';

export function QuizQuestion({ onRecord, onFinish }: QuizQuestionProps) {
  const quiz = useQuizStore((s) => s.quiz);
  const question = useQuizStore(getCurrentQuestion);
  const questionIndex = useQuizStore((s) => s.questionIndex);
  const selectedAnswer = useQuizStore((s) => s.selectedAnswer);
  const correct = useQuizStore(isAnswerCorrect);
  const isPlaying = useQuizStore((s) => s.isPlaying);
  const audioError = useQuizStore((s) => s.audioError);

  const answer = useQuizStore((s) => s.answer);
  const nextQuestion = useQuizStore((s) => s.nextQuestion);
  const playSound = useQuizStore((s) => s.playSound);
  const stopSound = useQuizStore((s) => s.stopSound);
  const exitQuiz = useQuizStore((s) => s.exitQuiz);

  if (quiz === null || question === null) return null;

  const total = quiz.questions.length;
  const answered = selectedAnswer !== null;
  const isLast = questionIndex === total - 1;

  const handleNext = () => {
    if (isLast) onFinish();
    nextQuestion();
  };

  const handleAnswer = (choice: boolean) => {
    if (answered) return;
    answer(choice);
    onRecord(question.id, choice);
  };

  const optionStyle = (choice: boolean): string => {
    if (!answered) return '';
    if (choice === question.answer) return CORRECT_STYLE;
    if (choice === selectedAnswer) return WRONG_STYLE;
    return 'opacity-60';
  };

  const answeredCount = questionIndex + (answered ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{quiz.label}</span>
          <span>
            Question {questionIndex + 1} of {total}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answeredCount}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${String((answeredCount / total) * 100)}%` }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold">{question.prompt}</h1>
          </CardTitle>
          <CardDescription>The sound loops until you stop it.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant={isPlaying ? 'secondary' : 'default'}
              onClick={() => {
                if (isPlaying) stopSound();
                else playSound();
              }}
            >
              {isPlaying ? <Square aria-hidden /> : <Play aria-hidden />}
              {isPlaying ? 'Stop sound' : 'Play sound'}
            </Button>
            {isPlaying && <Badge variant="secondary">Playing</Badge>}
          </div>

          {audioError !== null && (
            <p role="alert" className="text-sm text-destructive">
              Could not play the sound: {audioError}
            </p>
          )}

          <div className="flex gap-3">
            {([true, false] as const).map((choice) => (
              <Button
                key={String(choice)}
                type="button"
                variant="outline"
                className={`h-11 flex-1 text-base ${optionStyle(choice)}`}
                aria-pressed={selectedAnswer === choice}
                onClick={() => {
                  handleAnswer(choice);
                }}
              >
                {choice ? 'Yes' : 'No'}
              </Button>
            ))}
          </div>

          <div role="status" aria-live="polite">
            {answered && (
              <div className="space-y-1 rounded-lg bg-muted/60 p-3">
                <p
                  className={`flex items-center gap-1.5 font-semibold ${
                    correct === true ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'
                  }`}
                >
                  {correct === true ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <X className="size-4" aria-hidden />
                  )}
                  {correct === true ? 'Correct' : 'Not quite'}
                </p>
                <p className="text-sm">The answer is {question.answer ? 'Yes' : 'No'}.</p>
                {question.explanation !== undefined && (
                  <p className="text-sm text-muted-foreground">{question.explanation}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="justify-between">
          <Button type="button" variant="ghost" onClick={exitQuiz}>
            Exit quiz
          </Button>
          <Button type="button" onClick={handleNext} disabled={!answered}>
            {isLast ? 'See results' : 'Next question'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
