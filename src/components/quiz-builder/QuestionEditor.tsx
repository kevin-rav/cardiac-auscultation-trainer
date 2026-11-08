import { type ChangeEvent } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PRESET_SOUND_SETS } from '../../data';
import { useQuizBuilderStore, type DraftQuestion } from '../../store';
import { fieldClass, labelClass } from './fieldStyles';

interface QuestionEditorProps {
  question: DraftQuestion;
  /** Position in the quiz, starting at 0. */
  index: number;
  total: number;
}

/** The form for one question: prompt, sound, heart rate, answer and explanation. */
export function QuestionEditor({ question: q, index, total }: QuestionEditorProps) {
  const updateQuestion = useQuizBuilderStore((s) => s.updateQuestion);
  const setYesNoAnswer = useQuizBuilderStore((s) => s.setYesNoAnswer);
  const moveQuestion = useQuizBuilderStore((s) => s.moveQuestion);
  const removeQuestion = useQuizBuilderStore((s) => s.removeQuestion);

  const number = String(index + 1);
  const promptId = `prompt-${q.key}`;
  const soundId = `sound-${q.key}`;
  const bpmId = `bpm-${q.key}`;
  const explanationId = `explanation-${q.key}`;

  const handleBpm = (e: ChangeEvent<HTMLInputElement>) => {
    // An empty or half-typed box has no number yet, so leave the draft alone.
    const bpm = e.target.valueAsNumber;
    if (Number.isFinite(bpm)) updateQuestion(q.key, { bpm });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>
            <h3 className="text-base font-semibold">Question {number}</h3>
          </CardTitle>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move question ${number} up`}
              disabled={index === 0}
              onClick={() => {
                moveQuestion(q.key, -1);
              }}
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move question ${number} down`}
              disabled={index === total - 1}
              onClick={() => {
                moveQuestion(q.key, 1);
              }}
            >
              <ArrowDown aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove question ${number}`}
              onClick={() => {
                removeQuestion(q.key);
              }}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="space-y-1">
          <label htmlFor={promptId} className={labelClass}>
            Prompt
          </label>
          <input
            id={promptId}
            type="text"
            className={fieldClass}
            placeholder="Is this a normal heart sound?"
            value={q.prompt}
            onChange={(e) => {
              updateQuestion(q.key, { prompt: e.target.value });
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div className="space-y-1">
            <label htmlFor={soundId} className={labelClass}>
              Sound
            </label>
            <select
              id={soundId}
              className={fieldClass}
              value={q.soundSet}
              onChange={(e) => {
                updateQuestion(q.key, { soundSet: e.target.value });
              }}
            >
              <option value="">Choose a sound…</option>
              {PRESET_SOUND_SETS.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor={bpmId} className={labelClass}>
              Heart rate (BPM)
            </label>
            <input
              id={bpmId}
              type="number"
              min={30}
              max={220}
              className={fieldClass}
              defaultValue={q.bpm}
              onChange={handleBpm}
            />
          </div>
        </div>

        {q.type === 'yes-no' ? (
          <fieldset className="space-y-1">
            <legend className={labelClass}>Correct answer</legend>
            <div className="flex gap-4">
              {([true, false] as const).map((value) => (
                <label key={String(value)} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`answer-${q.key}`}
                    checked={q.answer === value}
                    onChange={() => {
                      setYesNoAnswer(q.key, value);
                    }}
                  />
                  {value ? 'Yes' : 'No'}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="text-sm text-muted-foreground">
            Multiple-choice answers can&apos;t be edited in the builder yet. You can still change
            the prompt, sound and explanation, or move or remove this question.
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor={explanationId} className={labelClass}>
            Explanation (optional)
          </label>
          <textarea
            id={explanationId}
            rows={2}
            className={fieldClass}
            placeholder="Shown to the learner after they answer."
            value={q.explanation}
            onChange={(e) => {
              updateQuestion(q.key, { explanation: e.target.value });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
