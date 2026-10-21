import { useEffect, useState } from "react";
import type { BudgetApiClient } from "../../api/budgetApi";
import { toErrorMessage } from "../../lib/errors";
import ConfirmDialog from "../../shared/ConfirmDialog";
import { useFinancialSummary } from "../home/useFinancialSummary";

const RESET_NOTICE_MS = 30_000;

type ResetDataDialogProps = {
  api: BudgetApiClient;
};

export default function ResetDataDialog({ api }: ResetDataDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetComplete, setResetComplete] = useState(false);
  const { refresh } = useFinancialSummary();

  useEffect(() => {
    if (!resetComplete) return;
    const timeoutId = window.setTimeout(() => setResetComplete(false), RESET_NOTICE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [resetComplete]);

  const openDialog = () => {
    setResetError(null);
    setResetComplete(false);
    setIsOpen(true);
  };

  const resetData = async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      await api.resetFinancialData();
      refresh();
      setResetComplete(true);
      setIsOpen(false);
    } catch (error) {
      setResetError(toErrorMessage(error, "Unable to reset financial data."));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={openDialog} className="rounded-2xl border border-rose-800 bg-rose-950/70 px-3 py-2 text-rose-200 transition hover:bg-rose-900 disabled:cursor-wait disabled:opacity-60">
          Start over
        </button>
        {resetComplete && <p className="rounded-xl border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200" role="status">Financial data has been cleared.</p>}
      </div>
      <ConfirmDialog
        isOpen={isOpen}
        titleId="reset-dialog-title"
        descriptionId="reset-dialog-description"
        onClose={() => {
          if (!isResetting) setIsOpen(false);
        }}
      >
        <h3 className="text-xl font-semibold text-white" id="reset-dialog-title">Start over?</h3>
        <p className="mt-3 text-sm leading-6 text-slate-300" id="reset-dialog-description">
          This permanently deletes transactions, goals, import history, and AI insights.
        </p>
        {resetError && <p className="mt-4 rounded-xl border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200" role="alert">Unable to reset financial data: {resetError}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="rounded-2xl bg-slate-800 px-3 py-2 text-slate-300 transition hover:bg-slate-700"
            onClick={() => setIsOpen(false)}
            disabled={isResetting}
            autoFocus
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-2xl border border-rose-800 bg-rose-950/70 px-3 py-2 text-rose-200 transition hover:bg-rose-900 disabled:cursor-wait disabled:opacity-60"
            onClick={() => void resetData()}
            disabled={isResetting}
          >
            {isResetting ? "Clearing data..." : "Delete financial data"}
          </button>
        </div>
      </ConfirmDialog>
    </>
  );
}
