import { TABS, type TabName } from "../types";
import type { KeyboardEvent } from "react";

type TabBarProps = {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
};

const TAB_LABELS: Record<TabName, string> = {
  home: "Home",
  goals: "Goals",
  ai: "AI",
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
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % TABS.length;
        break;
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
      className="flex border-b border-slate-800 bg-slate-900/90 p-2"
      role="tablist"
      aria-label="Dashboard sections"
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
          className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition${activeTab === tab ? " bg-slate-100 text-slate-950 shadow-sm" : " text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
