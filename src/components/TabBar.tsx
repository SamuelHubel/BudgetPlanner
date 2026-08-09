// This component will be used to display the tab bar at the top of the dashboard
// The tab bar will allow users to switch between the HomeTab and AITab components

import "./TabBar.css";

type TabName = "home" | "ai";
type Props = {
  activeTab: TabName;
  setActiveTab: (t: TabName) => void;
};

export default function TabBar({ activeTab, setActiveTab }: Props) {
  return (
    <div className="tabbar">
      {(["home", "ai"] as TabName[]).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => setActiveTab(tab)}
          className={"tab-item " + (activeTab === tab ? "tab-item-active" : "tab-item-inactive")}
        >
          {tab === "home" ? "Home" : "AI"}
        </button>
      ))}
    </div>
  );
}
