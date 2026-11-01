import { formatCurrency } from "../../shared/format";
import Alert from "../../shared/Alert";
import type { AllocationSummary } from "./budgetMath";

type OverAllocationWarningProps = {
  summary: AllocationSummary;
  currency: string;
};

/** Warns that a budget allocates more than the expected income. */
export default function OverAllocationWarning({
  summary,
  currency,
}: OverAllocationWarningProps) {
  if (summary.overCents === 0) return null;
  return (
    <Alert>
      You&apos;ve allocated {summary.allocatedPercent}% of your expected income,{" "}
      {formatCurrency(summary.overCents, currency)} more than you expect to
      earn. Spending this plan would mean dipping into savings or going into
      debt, so we recommend reducing your categories to 100% or less.
    </Alert>
  );
}
