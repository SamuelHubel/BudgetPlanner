import TabBar from "../shared/TabBar";
import Alert from "../shared/Alert";
import HomeTab from "../features/home/HomeTab";
import BudgetTab from "../features/budget/BudgetTab";
import GoalsTab from "../features/goals/GoalsTab";
import TransactionImport from "../features/import/TransactionImport";
import type { BudgetApiClient } from "../api/budgetApi";
import { FinancialSummaryProvider } from "../features/home/FinancialSummaryContext";
import ResetDataDialog from "../features/settings/ResetDataDialog";
import { TABS, type TabName } from "../types";
import Button from "../shared/Button";

type DashboardProps = {
  api: BudgetApiClient;
  onLock: () => Promise<boolean>;
  lockError: string;
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
};

/** Renders the content for one dashboard tab. */
function renderTab(tab: TabName, api: BudgetApiClient) {
  switch (tab) {
    case "home":
      return <HomeTab />;
    case "import":
      return <TransactionImport api={api} />;
    case "budget":
      return <BudgetTab api={api} />;
    case "goals":
      return <GoalsTab api={api} />;
  }
}

/** Displays the sidebar navigation, the active section, and lock/reset actions. */
export default function Dashboard({
  api,
  onLock,
  lockError,
  activeTab,
  onTabChange,
}: DashboardProps) {
  return (
    <FinancialSummaryProvider api={api}>
      <div className="flex h-screen">
        <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
          <p className="mb-6 px-3 text-base font-semibold text-slate-900">
            Budget Planner
          </p>
          <TabBar activeTab={activeTab} onTabChange={onTabChange} />
          <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 pt-4 text-sm">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onLock()}
            >
              Lock app
            </Button>
            <ResetDataDialog api={api} />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-8 text-slate-700">
          {lockError && <Alert className="mb-4">{lockError}</Alert>}
          {TABS.map((tab) => (
            <div
              key={tab}
              id={`dashboard-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`dashboard-tab-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              hidden={activeTab !== tab}
              className="focus-visible:outline-none"
            >
              {/* Only the active panel mounts, so each tab reloads its data
                  (e.g. goal progress after an import) when it is opened. */}
              {activeTab === tab && renderTab(tab, api)}
            </div>
          ))}
        </main>
      </div>
    </FinancialSummaryProvider>
  );
}
