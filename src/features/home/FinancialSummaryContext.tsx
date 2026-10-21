import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BudgetApiClient } from "../../api/budgetApi";
import { toErrorMessage } from "../../lib/errors";
import type { FinancialSummary } from "../../types";

/** Financial summary values and refresh operations for dashboard features. */
export type FinancialSummaryState = {
  summary: FinancialSummary | null;
  currency: string | null;
  error: string;
  isLoading: boolean;
  refresh: () => void;
};

/** Context carrying financial summary state to nested dashboard features. */
export const FinancialSummaryContext = createContext<FinancialSummaryState | null>(null);

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

  const refresh = useCallback(() => {
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError("");
    void Promise.all([api.getFinancialSummary(), api.getCurrency()])
      .then(([nextSummary, nextCurrency]) => {
        if (!isCurrent) return;
        setSummary(nextSummary);
        setCurrency(nextCurrency);
      })
      .catch((caughtError: unknown) => {
        if (isCurrent) {
          setError(toErrorMessage(caughtError, "Unable to load financial data."));
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [api, requestVersion]);

  const value = useMemo(
    () => ({ summary, currency, error, isLoading, refresh }),
    [summary, currency, error, isLoading, refresh],
  );
  return <FinancialSummaryContext.Provider value={value}>{children}</FinancialSummaryContext.Provider>;
}
