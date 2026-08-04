import React from "react";

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
