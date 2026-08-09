// This component will be used to display users financial data in a dashboard format
// This is the "background" component that will be used to display the HomeTab and AITab components on top of itself

import "./Dashboard.css";
import TabBar from "./TabBar";
import HomeTab from "./HomeTab";
import AITab from "./AITab";

type TabName = "home" | "ai";

type Props = {
  lockApp: () => Promise<void>;
  activeTab: TabName;
  setActiveTab: (t: TabName) => void;
};

export default function Dashboard({ lockApp, activeTab, setActiveTab }: Props) {
  return (
    <div className="dashboard-root">
      <div className="dashboard-header">
        <div>
          <p className="kicker">Welcome back</p>
          <h2 className="dashboard-title">Your budget dashboard</h2>
        </div>
        <div className="dashboard-actions">
          <span className="pill">Locked mode</span>
          <button type="button" onClick={lockApp} className="muted-btn">Lock app</button>
        </div>
      </div>

      <div className="panel">
        <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="panel-body">
          {activeTab === "home" ? <HomeTab /> : <AITab />}
        </div>
      </div>
    </div>
  );
}
