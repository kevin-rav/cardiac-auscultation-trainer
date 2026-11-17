import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuizBuilderStore, type DraftQuestion } from '../../store';
import { fieldClass, labelClass } from './fieldStyles';

/** The quiz file format allows 2 to 6 choices per question. */
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 6;

interface ChoiceEditorProps {
  question: Extract<DraftQuestion, { type: 'multiple-choice' }>;
}

/** The choices of a multiple-choice question, with a radio to mark the correct one. */
export function ChoiceEditor({ question: q }: ChoiceEditorProps) {
  const addChoice = useQuizBuilderStore((s) => s.addChoice);
  const updateChoice = useQuizBuilderStore((s) => s.updateChoice);
  const removeChoice = useQuizBuilderStore((s) => s.removeChoice);
  const setCorrectChoice = useQuizBuilderStore((s) => s.setCorrectChoice);

  const canRemove = q.choices.length > MIN_CHOICES;
  const canAdd = q.choices.length < MAX_CHOICES;

  return (
    <fieldset className="space-y-2">
      <legend className={labelClass}>Choices</legend>
      <p className="text-xs text-muted-foreground">Mark the correct answer.</p>

      <ol className="flex flex-col gap-2">
        {q.choices.map((choice, index) => {
          const name = `Choice ${String(index + 1)}`;
          return (
            <li key={choice.key} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${q.key}`}
                className="size-4 shrink-0"
                aria-label={`${name} is correct`}
                checked={q.answerKey === choice.key}
                onChange={() => {
                  setCorrectChoice(q.key, choice.key);
                }}
              />
              <input
                type="text"
                className={fieldClass}
                aria-label={name}
                placeholder={name}
                value={choice.label}
                onChange={(e) => {
                  updateChoice(q.key, choice.key, e.target.value);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove choice ${String(index + 1)}`}
                disabled={!canRemove}
                onClick={() => {
                  removeChoice(q.key, choice.key);
                }}
              >
                <X aria-hidden />
              </Button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canAdd}
          onClick={() => {
            addChoice(q.key);
          }}
        >
          <Plus aria-hidden />
          Add choice
        </Button>
        {!canAdd && (
          <span className="text-xs text-muted-foreground">
            Up to {String(MAX_CHOICES)} choices.
          </span>
        )}
      </div>
    </fieldset>
  );
}
