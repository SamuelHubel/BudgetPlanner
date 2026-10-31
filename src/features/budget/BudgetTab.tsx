import { useState } from "react";
import type { BudgetApiClient } from "../../api/budgetApi";
import Button from "../../shared/Button";
import type { Budget } from "../../types";
import { useFinancialSummary } from "../home/useFinancialSummary";
import BudgetBuilderDialog from "./BudgetBuilderDialog";
import { currentMonth } from "./budgetMath";
import BudgetSummary from "./BudgetSummary";
import DeleteBudgetDialog from "./DeleteBudgetDialog";
import IncomeForm from "./IncomeForm";
import MonthSelector from "./MonthSelector";
import { useBudget } from "./useBudget";

/** Where the user is in the two-phase build flow. */
type BuildStep =
  | { phase: "viewing" }
  | { phase: "income" }
  | { phase: "allocating"; incomeCents: number };

type BudgetTabProps = {
  api: BudgetApiClient;
};

/** Lets users build a monthly budget and compare it with actual spending. */
export default function BudgetTab({ api }: BudgetTabProps) {
  const [month, setMonth] = useState(() => currentMonth(new Date()));
  const [step, setStep] = useState<BuildStep>({ phase: "viewing" });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { view, categories, error, saveBudget, deleteBudget } = useBudget(
    api,
    month,
  );
  const { currency } = useFinancialSummary();
  const displayCurrency = currency ?? "USD";

  // Data for the previous month stays in state until the new month arrives.
  const monthView = view?.month === month ? view : null;
  const budget = monthView?.budget ?? null;
  const source = budget ?? monthView?.template ?? null;

  const changeMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    setStep({ phase: "viewing" });
  };

  const handleSave = async (nextBudget: Budget) => {
    await saveBudget(nextBudget);
    setStep({ phase: "viewing" });
  };

  const handleDelete = async () => {
    await deleteBudget();
    setIsDeleteOpen(false);
    setStep({ phase: "viewing" });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white">Budget</h3>
        <p className="text-sm text-slate-400">
          Plan how your expected income gets spent each month, then track it
          against your imported transactions.
        </p>
      </div>

      <MonthSelector month={month} onChange={changeMonth} />

      {error && (
        <p
          className="rounded-xl bg-rose-950/60 px-3 py-2 text-sm text-rose-200"
          role="alert"
        >
          Unable to load the budget: {error}
        </p>
      )}
      {!monthView && !error && (
        <p className="py-3 text-sm text-slate-400" role="status">
          Loading budget…
        </p>
      )}

      {monthView && (
        <>
          {!budget || step.phase !== "viewing" ? (
            <IncomeForm
              key={`${month}:${source?.month}`}
              month={month}
              initialCents={source?.expectedIncomeCents ?? null}
              templateMonth={budget ? null : (source?.month ?? null)}
              onContinue={(incomeCents) =>
                setStep({ phase: "allocating", incomeCents })
              }
              onCancel={
                budget ? () => setStep({ phase: "viewing" }) : undefined
              }
            />
          ) : (
            <>
              <BudgetSummary
                budget={budget}
                view={monthView}
                categories={categories}
                currency={displayCurrency}
              />
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setIsDeleteOpen(true)}
                >
                  Delete budget
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setStep({ phase: "income" })}
                >
                  Edit budget
                </Button>
              </div>
            </>
          )}

          {step.phase === "allocating" && (
            <BudgetBuilderDialog
              month={month}
              incomeCents={step.incomeCents}
              source={source}
              categories={categories}
              currency={displayCurrency}
              onSave={handleSave}
              onCancel={() => setStep({ phase: "income" })}
            />
          )}
          <DeleteBudgetDialog
            isOpen={isDeleteOpen}
            month={month}
            onConfirm={handleDelete}
            onClose={() => setIsDeleteOpen(false)}
          />
        </>
      )}
    </div>
  );
}
