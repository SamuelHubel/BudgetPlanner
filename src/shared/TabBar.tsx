type TabName = "home" | "ai";

type TabBarProps = {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
};

const TAB_LABELS: Record<TabName, string> = {
  home: "Home",
  ai: "AI",
};

export default function TabBar({ activeTab, setActiveTab }: TabBarProps) {
  const tabs = Object.keys(TAB_LABELS) as TabName[];
  return (
    <div className="flex border-b border-slate-800 bg-slate-900/90 p-2">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => setActiveTab(tab)}
          className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition${activeTab === tab ? " bg-slate-100 text-slate-950 shadow-sm" : " text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
