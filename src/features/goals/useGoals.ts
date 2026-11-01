import { useCallback, useEffect, useState } from "react";
import type { BudgetApiClient } from "../../api/budgetApi";
import { toErrorMessage } from "../../shared/errors";
import type { Category, Goal, GoalInput } from "../../types";
import { useFinancialSummary } from "../home/useFinancialSummary";

/** Goal list state and mutations for the Goals tab. */
export type GoalsState = {
  /** Goals in display order: newest first, as returned by the backend. */
  goals: Goal[];
  /** Expense categories a goal can track spending in. */
  categories: Category[];
  /** Load error message, or an empty string. */
  error: string;
  isLoading: boolean;
  /** Creates a goal. Rejects with the backend error so forms can show it. */
  createGoal: (input: GoalInput) => Promise<void>;
  /** Updates a goal. Rejects with the backend error so forms can show it. */
  updateGoal: (id: number, input: GoalInput) => Promise<void>;
  /** Deletes a goal. Rejects with the backend error so dialogs can show it. */
  deleteGoal: (id: number) => Promise<void>;
};

/** Loads goals and expense categories and exposes goal mutations. */
export function useGoals(api: BudgetApiClient): GoalsState {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // "Start over" lives outside this tab and refreshes the summary, so a new
  // summary means goals may have been deleted. Reloads stay silent: showing the
  // loading state would unmount the list and discard any edit in progress.
  const { summary } = useFinancialSummary();

  useEffect(() => {
    let isCurrent = true;
    setError("");
    void Promise.all([api.listGoals(), api.listCategories()])
      .then(([nextGoals, nextCategories]) => {
        if (!isCurrent) return;
        setGoals(nextGoals);
        setCategories(
          nextCategories.filter((category) => category.type === "expense"),
        );
      })
      .catch((caughtError: unknown) => {
        if (isCurrent) {
          setError(toErrorMessage(caughtError, "Unable to load goals."));
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [api, summary]);

  // Reload after every mutation instead of patching local state, so the order
  // and computed progress always come from the backend.
  const reloadGoals = useCallback(async () => {
    setGoals(await api.listGoals());
  }, [api]);

  const createGoal = useCallback(
    async (input: GoalInput) => {
      await api.createGoal(input);
      await reloadGoals();
    },
    [api, reloadGoals],
  );

  const updateGoal = useCallback(
    async (id: number, input: GoalInput) => {
      await api.updateGoal(id, input);
      await reloadGoals();
    },
    [api, reloadGoals],
  );

  const deleteGoal = useCallback(
    async (id: number) => {
      await api.deleteGoal(id);
      await reloadGoals();
    },
    [api, reloadGoals],
  );

  return {
    goals,
    categories,
    error,
    isLoading,
    createGoal,
    updateGoal,
    deleteGoal,
  };
}
