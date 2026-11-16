import { TABS, type TabName } from "../types";
import type { KeyboardEvent } from "react";

type TabBarProps = {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
};

const TAB_LABELS: Record<TabName, string> = {
  home: "Home",
  import: "Import",
  budget: "Budget",
  goals: "Goals",
};

/** Renders the dashboard's available section tabs. */
export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: TabName,
  ) => {
    const currentIndex = TABS.indexOf(tab);
    let nextIndex: number;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % TABS.length;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = TABS.length - 1;
        break;
      default:
        return;
    }

    const nextTab = TABS[nextIndex];
    if (!nextTab) return;
    event.preventDefault();
    onTabChange(nextTab);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-tab="${nextTab}"]`)
      ?.focus();
  };

  return (
    <div
      className="flex flex-col gap-1"
      role="tablist"
      aria-label="Dashboard sections"
      aria-orientation="vertical"
    >
      {TABS.map((tab) => (
        <button
          key={tab}
          id={`dashboard-tab-${tab}`}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          aria-controls={`dashboard-panel-${tab}`}
          tabIndex={activeTab === tab ? 0 : -1}
          data-tab={tab}
          onClick={() => onTabChange(tab)}
          onKeyDown={(event) => handleKeyDown(event, tab)}
          className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2${activeTab === tab ? " bg-slate-900 text-white" : " text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
