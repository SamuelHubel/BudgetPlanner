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
      className="space-y-3 rounded-3xl border border-slate-800 bg-slate-950/80 p-4"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="space-y-1">
        <label
          className="text-sm font-medium text-slate-300"
          htmlFor={`${fieldId}-income`}
        >
          Expected monthly income
        </label>
        <input
          id={`${fieldId}-income`}
          className="block w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none sm:max-w-xs"
          inputMode="decimal"
          placeholder="5000.00"
          aria-required="true"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <p className="text-sm text-slate-400">
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
