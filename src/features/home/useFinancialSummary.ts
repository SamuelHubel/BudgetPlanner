import { useContext } from "react";
import {
  FinancialSummaryContext,
  type FinancialSummaryState,
} from "./FinancialSummaryContext";

/** Reads the current dashboard summary context. */
export function useFinancialSummary(): FinancialSummaryState {
  const context = useContext(FinancialSummaryContext);
  if (!context) {
    throw new Error(
      "useFinancialSummary must be used within FinancialSummaryProvider.",
    );
  }
  return context;
}
