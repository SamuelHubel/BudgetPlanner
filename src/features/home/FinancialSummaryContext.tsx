import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BudgetApiClient } from "../../api/budgetApi";
import { toErrorMessage } from "../../shared/errors";
import type { CategorySettings, FinancialSummary } from "../../types";

/** Financial summary values and refresh operations for dashboard features. */
export type FinancialSummaryState = {
  summary: FinancialSummary | null;
  currency: string | null;
  error: string;
  isLoading: boolean;
  refresh: () => void;
  /** Remembered subcategory choices, or `null` until first loaded. */
  categorySettings: CategorySettings | null;
  /** Saves changed choices, restoring the previous ones and rethrowing on failure. */
  updateCategorySettings: (changes: Partial<CategorySettings>) => Promise<void>;
};

/** Context carrying financial summary state to nested dashboard features. */
export const FinancialSummaryContext =
  createContext<FinancialSummaryState | null>(null);

/** Provides financial-summary loading state to dashboard features. */
export function FinancialSummaryProvider({
  api,
  children,
}: {
  api: BudgetApiClient;
  children: ReactNode;
}) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [requestVersion, setRequestVersion] = useState(0);
  const [categorySettings, setCategorySettings] =
    useState<CategorySettings | null>(null);

  const refresh = useCallback(() => {
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError("");
    void Promise.all([
      api.getFinancialSummary(),
      api.getCurrency(),
      api.getCategorySettings(),
    ])
      .then(([nextSummary, nextCurrency, nextSettings]) => {
        if (!isCurrent) return;
        setSummary(nextSummary);
        setCurrency(nextCurrency);
        setCategorySettings(nextSettings);
      })
      .catch((caughtError: unknown) => {
        if (isCurrent) {
          setError(
            toErrorMessage(caughtError, "Unable to load financial data."),
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [api, requestVersion]);

  const updateCategorySettings = useCallback(
    async (changes: Partial<CategorySettings>) => {
      if (!categorySettings) return;
      const next = { ...categorySettings, ...changes };
      setCategorySettings(next);
      try {
        setCategorySettings(await api.updateCategorySettings(next));
      } catch (caughtError) {
        setCategorySettings(categorySettings);
        throw caughtError;
      }
    },
    [api, categorySettings],
  );

  const value = useMemo(
    () => ({
      summary,
      currency,
      error,
      isLoading,
      refresh,
      categorySettings,
      updateCategorySettings,
    }),
    [
      summary,
      currency,
      error,
      isLoading,
      refresh,
      categorySettings,
      updateCategorySettings,
    ],
  );
  return (
    <FinancialSummaryContext.Provider value={value}>
      {children}
    </FinancialSummaryContext.Provider>
  );
}
