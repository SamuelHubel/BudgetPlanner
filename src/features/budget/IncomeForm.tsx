import { useId, useState, type FormEvent } from "react";
import Alert from "../../shared/Alert";
import Button from "../../shared/Button";
import { formatMonth } from "../../shared/format";
import {
  centsToAmountInput,
  parseAmountInput,
} from "../../shared/parseAmountInput";

type IncomeFormProps = {
  month: string;
  /** Pre-filled income, or `null` for an empty field. */
  initialCents: number | null;
  /** Month the pre-filled values come from, when copying forward. */
  templateMonth: string | null;
  /** Moves on to the budget builder with the entered income. */
  onContinue: (incomeCents: number) => void;
  /** Shows a Cancel button when provided (used while editing). */
  onCancel?: () => void;
};

/** Phase one of building a budget: collects the expected monthly income. */
export default function IncomeForm({
  month,
  initialCents,
  templateMonth,
  onContinue,
  onCancel,
}: IncomeFormProps) {
  const fieldId = useId();
  const [text, setText] = useState(centsToAmountInput(initialCents));
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const income = parseAmountInput(text, { label: "income" });
    if (!income.ok) {
      setError(income.error);
      return;
    }
    if (income.cents === null) {
      setError("Enter your expected income to continue.");
      return;
    }
    setError("");
    onContinue(income.cents);
  };

  return (
    <form
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="space-y-1">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor={`${fieldId}-income`}
        >
          Expected monthly income
        </label>
        <input
          id={`${fieldId}-income`}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:max-w-xs"
          inputMode="decimal"
          placeholder="5000.00"
          aria-required="true"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <p className="text-sm text-slate-500">
          {templateMonth
            ? `Starting from ${formatMonth(templateMonth)}. Change anything that's different this month.`
            : `What you expect to earn in ${formatMonth(month)}.`}
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary">
          Continue
        </Button>
      </div>
    </form>
  );
}
