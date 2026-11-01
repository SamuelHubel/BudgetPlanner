import { useEffect, useState } from "react";
import type { BudgetApiClient } from "../../api/budgetApi";
import Button from "../../shared/Button";
import ConfirmDialog from "../../shared/ConfirmDialog";
import { useFinancialSummary } from "../home/useFinancialSummary";

const RESET_NOTICE_MS = 30_000;

type ResetDataDialogProps = {
  api: BudgetApiClient;
};

/** Confirms and runs a full financial-data reset. */
export default function ResetDataDialog({ api }: ResetDataDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const { refresh } = useFinancialSummary();

  useEffect(() => {
    if (!resetComplete) return;
    const timeoutId = window.setTimeout(
      () => setResetComplete(false),
      RESET_NOTICE_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [resetComplete]);

  const openDialog = () => {
    setResetComplete(false);
    setIsOpen(true);
  };

  const resetData = async () => {
    await api.resetFinancialData();
    refresh();
    setResetComplete(true);
    setIsOpen(false);
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button type="button" variant="danger" onClick={openDialog}>
          Start over
        </Button>
        {resetComplete && (
          <p
            className="rounded-xl border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200"
            role="status"
          >
            Financial data has been cleared.
          </p>
        )}
      </div>
      <ConfirmDialog
        isOpen={isOpen}
        title="Start over?"
        description="This permanently deletes transactions, budgets, goals, import history, and AI insights."
        confirmLabel="Delete financial data"
        pendingLabel="Clearing data..."
        errorFallback="Unable to reset financial data."
        onConfirm={resetData}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
