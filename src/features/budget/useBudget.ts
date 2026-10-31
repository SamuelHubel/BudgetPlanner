import { useCallback, useEffect, useState } from "react";
import type { BudgetApiClient } from "../../api/budgetApi";
import { toErrorMessage } from "../../lib/errors";
import type { Budget, BudgetMonth, Category } from "../../types";
import { useFinancialSummary } from "../home/useFinancialSummary";

/** One month's budget state and mutations for the Budget tab. */
export type BudgetState = {
  /** The selected month's data, or `null` until it has loaded. */
  view: BudgetMonth | null;
  /** Expense categories, in display order. */
  categories: Category[];
  /** Load error message, or an empty string. */
  error: string;
  /** Saves a budget. Rejects with the backend error so forms can show it. */
  saveBudget: (budget: Budget) => Promise<void>;
  /** Deletes the month's budget. Rejects with the backend error. */
  deleteBudget: () => Promise<void>;
};

/** Loads a month's budget and expense categories and exposes mutations. */
export function useBudget(api: BudgetApiClient, month: string): BudgetState {
  const [view, setView] = useState<BudgetMonth | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  // "Start over" lives outside this tab and refreshes the summary, so a new
  // summary means this month's data may have been deleted too.
  const { summary } = useFinancialSummary();

  useEffect(() => {
    let isCurrent = true;
    setError("");
    void Promise.all([api.getBudget(month), api.listCategories()])
      .then(([nextView, nextCategories]) => {
        if (!isCurrent) return;
        setView(nextView);
        setCategories(
          nextCategories.filter((category) => category.type === "expense"),
        );
      })
      .catch((caughtError: unknown) => {
        if (isCurrent) {
          setError(toErrorMessage(caughtError, "Unable to load the budget."));
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [api, month, summary]);

  const saveBudget = useCallback(
    async (budget: Budget) => {
      await api.saveBudget(budget);
      setView(await api.getBudget(budget.month));
    },
    [api],
  );

  const deleteBudget = useCallback(async () => {
    await api.deleteBudget(month);
    setView(await api.getBudget(month));
  }, [api, month]);

  return { view, categories, error, saveBudget, deleteBudget };
}
