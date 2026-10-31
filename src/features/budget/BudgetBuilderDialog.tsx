import { useId, useState } from "react";
import { toErrorMessage } from "../../lib/errors";
import Button from "../../shared/Button";
import Dialog from "../../shared/Dialog";
import { formatCurrency, formatMonth } from "../../shared/format";
import { parseAmountInput } from "../../shared/parseAmountInput";
import type {
  Budget,
  BudgetAllocation,
  BudgetInputMode,
  Category,
} from "../../types";
import { centsToLimitInput } from "../goals/parseLimitInput";
import AllocationRow from "./AllocationRow";
import BudgetDonut from "./BudgetDonut";
import {
  carryAllocations,
  centsToBasisPoints,
  percentToCents,
  summarizeAllocations,
} from "./budgetMath";
import OverAllocationWarning from "./OverAllocationWarning";

const MODES: { value: BudgetInputMode; label: string }[] = [
  { value: "percent", label: "Percent" },
  { value: "amount", label: "Amount" },
];

type BudgetBuilderDialogProps = {
  month: string;
  incomeCents: number;
  /** The saved budget or template to start from, if any. */
  source: Budget | null;
  /** Expense categories, in display order. */
  categories: Category[];
  currency: string;
  /** Saves the budget; a rejection keeps the dialog open with the error. */
  onSave: (budget: Budget) => Promise<void>;
  onCancel: () => void;
};

/** Phase two of building a budget: allocates income across categories. */
export default function BudgetBuilderDialog({
  month,
  incomeCents,
  source,
  categories,
  currency,
  onSave,
  onCancel,
}: BudgetBuilderDialogProps) {
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  const [initialCents] = useState(() => carryAllocations(source, incomeCents));
  const [mode, setMode] = useState<BudgetInputMode>(
    source?.inputMode ?? "percent",
  );
  const [basisPoints, setBasisPoints] = useState<Record<number, number>>(() =>
    mapCategories(categories, ({ id }) =>
      centsToBasisPoints(initialCents[id] ?? 0, incomeCents),
    ),
  );
  const [amountTexts, setAmountTexts] = useState<Record<number, string>>(() =>
    mapCategories(categories, ({ id }) => {
      const cents = initialCents[id];
      return cents ? centsToLimitInput(cents) : "";
    }),
  );
  const [activeId, setActiveId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const parseRowAmount = ({ id, name }: Category) =>
    parseAmountInput(amountTexts[id] ?? "", {
      label: `${name} amount`,
      allowZero: true,
    });

  /** A row's cents under the current mode; invalid text counts as nothing. */
  const rowCents = (category: Category) => {
    if (mode === "percent") {
      return percentToCents(incomeCents, basisPoints[category.id] ?? 0);
    }
    const amount = parseRowAmount(category);
    return amount.ok ? (amount.cents ?? 0) : 0;
  };

  const rows = categories.map((category) => ({
    ...category,
    cents: rowCents(category),
  }));
  const summary = summarizeAllocations(
    rows.map(({ cents }) => cents),
    incomeCents,
  );

  const switchMode = (nextMode: BudgetInputMode) => {
    if (nextMode === mode) return;
    if (nextMode === "amount") {
      setAmountTexts(
        mapCategories(rows, ({ cents }) =>
          cents ? centsToLimitInput(cents) : "",
        ),
      );
    } else {
      setBasisPoints(
        mapCategories(rows, ({ cents }) =>
          centsToBasisPoints(cents, incomeCents),
        ),
      );
    }
    setError("");
    setMode(nextMode);
  };

  const save = async () => {
    if (mode === "amount") {
      for (const category of categories) {
        const amount = parseRowAmount(category);
        if (!amount.ok) {
          setError(amount.error);
          return;
        }
      }
    }
    const allocations: BudgetAllocation[] = rows
      .filter(({ cents }) => cents > 0)
      .map(({ id, cents }) => ({ categoryId: id, amountCents: cents }));

    setError("");
    setIsSaving(true);
    try {
      await onSave({
        month,
        expectedIncomeCents: incomeCents,
        inputMode: mode,
        allocations,
      });
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Unable to save the budget."));
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      isOpen
      titleId={titleId}
      descriptionId={descriptionId}
      role="dialog"
      className="m-auto w-full max-w-4xl"
      onClose={() => {
        if (!isSaving) onCancel();
      }}
    >
      <h3 className="text-xl font-semibold text-white" id={titleId}>
        Build your {formatMonth(month)} budget
      </h3>
      <p className="mt-1 text-sm text-slate-400" id={descriptionId}>
        Allocate your expected income of {formatCurrency(incomeCents, currency)}{" "}
        across your categories.
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="md:pt-12">
          <BudgetDonut
            rows={rows}
            incomeCents={incomeCents}
            summary={summary}
            currency={currency}
            activeId={activeId}
          />
        </div>

        <div className="min-w-0 space-y-3">
          <div
            className="inline-flex rounded-2xl bg-slate-800 p-1"
            role="group"
            aria-label="Allocation input"
          >
            {MODES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`rounded-xl px-3 py-1 text-sm font-semibold transition ${mode === value ? "bg-slate-100 text-slate-950" : "text-slate-300 hover:text-white"}`}
                aria-pressed={mode === value}
                onClick={() => switchMode(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
            {rows.map((row) => (
              <AllocationRow
                key={row.id}
                category={row}
                mode={mode}
                cents={row.cents}
                basisPoints={basisPoints[row.id] ?? 0}
                percent={
                  summarizeAllocations([row.cents], incomeCents)
                    .allocatedPercent
                }
                amountText={amountTexts[row.id] ?? ""}
                isInvalid={mode === "amount" && !parseRowAmount(row).ok}
                currency={currency}
                onPercentChange={(value) =>
                  setBasisPoints((current) => ({
                    ...current,
                    [row.id]: value,
                  }))
                }
                onAmountChange={(text) =>
                  setAmountTexts((current) => ({ ...current, [row.id]: text }))
                }
                onActiveChange={(isActive) =>
                  setActiveId((current) =>
                    isActive ? row.id : current === row.id ? null : current,
                  )
                }
              />
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <OverAllocationWarning summary={summary} currency={currency} />
        {error && (
          <p
            className="rounded-xl border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => void save()}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save budget"}
        </Button>
      </div>
    </Dialog>
  );
}

/** Builds a record keyed by id from a list of categories. */
function mapCategories<Item extends { id: number }, Value>(
  items: Item[],
  toValue: (item: Item) => Value,
): Record<number, Value> {
  return Object.fromEntries(items.map((item) => [item.id, toValue(item)]));
}
