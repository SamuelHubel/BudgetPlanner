import { useId, useState, type FormEvent } from "react";
import Alert from "../../shared/Alert";
import { toErrorMessage } from "../../shared/errors";
import Button from "../../shared/Button";
import type { Category, GoalInput } from "../../types";
import {
  centsToAmountInput,
  parseAmountInput,
} from "../../shared/parseAmountInput";

/** Maximum goal text length; mirrors `MAX_GOAL_TITLE_CHARS` in the Rust core. */
export const MAX_GOAL_TITLE_LENGTH = 500;

const EMPTY_GOAL: GoalInput = {
  title: "",
  categoryId: null,
  spendingLimitCents: null,
};

type GoalFormProps = {
  /** Expense categories offered for spending tracking. */
  categories: Category[];
  /** Initial field values; omitted when creating a new goal. */
  initialValue?: GoalInput;
  submitLabel: string;
  /** Saves the goal. A rejection is shown inline and keeps the form open. */
  onSubmit: (input: GoalInput) => Promise<void>;
  /** Shows a Cancel button when provided (used while editing). */
  onCancel?: () => void;
  /** Clears the fields after a successful submit (used when creating). */
  resetOnSubmit?: boolean;
};

/** Collects goal text and an optional category spending link. */
export default function GoalForm({
  categories,
  initialValue = EMPTY_GOAL,
  submitLabel,
  onSubmit,
  onCancel,
  resetOnSubmit = false,
}: GoalFormProps) {
  const fieldId = useId();
  const [title, setTitle] = useState(initialValue.title);
  const [categoryId, setCategoryId] = useState(
    initialValue.categoryId === null ? "" : String(initialValue.categoryId),
  );
  const [limitText, setLimitText] = useState(
    centsToAmountInput(initialValue.spendingLimitCents),
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isTracking = categoryId !== "";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Describe your goal before saving.");
      return;
    }
    // An untracked goal needs only its text. The limit is read only when a
    // category is chosen; the backend requires both or neither.
    let spendingLimitCents: number | null = null;
    if (isTracking) {
      const limit = parseAmountInput(limitText, { label: "monthly limit" });
      if (!limit.ok) {
        setError(limit.error);
        return;
      }
      if (limit.cents === null) {
        setError(
          "Enter a monthly limit to track this category, or choose Don't track.",
        );
        return;
      }
      spendingLimitCents = limit.cents;
    }

    setError("");
    setIsSaving(true);
    try {
      await onSubmit({
        title: trimmedTitle,
        categoryId: isTracking ? Number(categoryId) : null,
        spendingLimitCents,
      });
      if (resetOnSubmit) {
        setTitle(EMPTY_GOAL.title);
        setCategoryId("");
        setLimitText("");
      }
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Unable to save the goal."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
    >
      <div className="space-y-1">
        <label
          className="text-sm font-medium text-slate-300"
          htmlFor={`${fieldId}-title`}
        >
          Your goal
        </label>
        <textarea
          id={`${fieldId}-title`}
          className="block min-h-20 w-full resize-y rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          placeholder='For example, "Spend less on dining out"'
          maxLength={MAX_GOAL_TITLE_LENGTH}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-slate-300"
            htmlFor={`${fieldId}-category`}
          >
            Track spending in (optional)
          </label>
          <select
            id={`${fieldId}-category`}
            className="block w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              // Switching back to "Don't track" discards any entered limit.
              if (event.target.value === "") setLimitText("");
            }}
          >
            <option value="">Don&apos;t track</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        {/* The limit only applies to tracked goals, so it appears (and is
            required) once a category is chosen. */}
        {isTracking && (
          <div className="space-y-1">
            <label
              className="text-sm font-medium text-slate-300"
              htmlFor={`${fieldId}-limit`}
            >
              Monthly limit
            </label>
            <input
              id={`${fieldId}-limit`}
              className="block w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              inputMode="decimal"
              placeholder="300.00"
              aria-required="true"
              value={limitText}
              onChange={(event) => setLimitText(event.target.value)}
            />
          </div>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={isSaving}>
          {isSaving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
