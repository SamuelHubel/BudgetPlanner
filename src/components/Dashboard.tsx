import TabBar from "../shared/TabBar";
import HomeTab from "../features/home/HomeTab";
import AITab from "./AITab";
import type { BudgetApiClient } from "../api/budgetApi";
import { FinancialSummaryProvider } from "../features/home/FinancialSummaryContext";
import ResetDataDialog from "../features/settings/ResetDataDialog";
import type { TabName } from "../types";
import Button from "../shared/Button";

type DashboardProps = {
  api: BudgetApiClient;
  onLock: () => Promise<boolean>;
  lockError: string;
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
};

/** Displays dashboard content, tabs, and lock/reset actions. */
export default function Dashboard({ api, onLock, lockError, activeTab, onTabChange }: DashboardProps) {
  return (
    <FinancialSummaryProvider api={api}>
      <div className="flex flex-1 flex-col rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/40">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-slate-400">Welcome back</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Your budget dashboard</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <ResetDataDialog api={api} />
            <Button type="button" variant="secondary" onClick={() => void onLock()}>Lock app</Button>
          </div>
        </div>

        {lockError && <p className="mt-4 rounded-xl border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200" role="alert">{lockError}</p>}

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/90">
          <TabBar activeTab={activeTab} onTabChange={onTabChange} />

          <div className="p-6 text-slate-200">
            {activeTab === "home" ? <HomeTab api={api} /> : <AITab />}
          </div>
        </div>
      </div>
    </FinancialSummaryProvider>
  );
}
