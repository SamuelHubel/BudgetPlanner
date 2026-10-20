// This component will be used to display users financial data in a dashboard format
// This is the "background" component that will be used to display the HomeTab and AITab components on top of itself

import "./Dashboard.css";
import { useEffect, useState } from "react";
import TabBar from "./TabBar";
import HomeTab from "./HomeTab";
import AITab from "./AITab";
import type { BudgetApiClient } from "../api/budgetApi";
import { toErrorMessage } from "../lib/errors";

type TabName = "home" | "ai";

type Props = {
  api: BudgetApiClient;
  lockApp: () => Promise<boolean>;
  lockError: string;
  activeTab: TabName;
  setActiveTab: (t: TabName) => void;
};

export default function Dashboard({ api, lockApp, lockError, activeTab, setActiveTab }: Props) {
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetComplete, setResetComplete] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);

  useEffect(() => {
    if (!resetComplete) return;

    const timeoutId = window.setTimeout(() => setResetComplete(false), 30_000);
    return () => window.clearTimeout(timeoutId);
  }, [resetComplete]);

  const openResetDialog = () => {
    setResetError(null);
    setResetComplete(false);
    setIsResetDialogOpen(true);
  };

  const resetData = async () => {
    setIsResetting(true);
    setResetError(null);

    try {
      await api.resetFinancialData();
      setResetVersion((version) => version + 1);
      setResetComplete(true);
      setIsResetDialogOpen(false);
    } catch (error) {
      setResetError(toErrorMessage(error, "Unable to reset financial data."));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="dashboard-root">
      <div className="dashboard-header">
        <div>
          <p className="kicker">Welcome back</p>
          <h2 className="dashboard-title">Your budget dashboard</h2>
        </div>
        <div className="dashboard-actions">
          <button type="button" onClick={openResetDialog} className="reset-btn">Start over</button>
          <button type="button" onClick={lockApp} className="muted-btn">Lock app</button>
        </div>
      </div>

      {lockError && <p className="reset-feedback reset-error" role="alert">{lockError}</p>}

      {resetComplete && (
        <p className="reset-feedback reset-success" role="status">
          Financial data has been cleared.
        </p>
      )}

      <div className="panel">
        <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="panel-body">
          {activeTab === "home" ? <HomeTab key={resetVersion} api={api} /> : <AITab />}
        </div>
      </div>

      {isResetDialogOpen && (
        <div className="reset-backdrop">
          <section
            className="reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            aria-describedby="reset-dialog-description"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !isResetting) {
                setIsResetDialogOpen(false);
              }
            }}
          >
            <h3 id="reset-dialog-title">Start over?</h3>
            <p id="reset-dialog-description">
              This permanently deletes transactions, goals, import history, and AI insights.
            </p>
            {resetError && <p className="reset-feedback reset-error" role="alert">Unable to reset financial data: {resetError}</p>}
            <div className="reset-dialog-actions">
              <button
                type="button"
                className="muted-btn"
                onClick={() => setIsResetDialogOpen(false)}
                disabled={isResetting}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className="reset-btn"
                onClick={resetData}
                disabled={isResetting}
              >
                {isResetting ? "Clearing data..." : "Delete financial data"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
