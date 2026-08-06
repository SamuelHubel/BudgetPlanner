

import "./HomeTab.css";

export default function HomeTab() {
  return (
    <div className="tab-content">
      <div className="stack">
        <h3 className="tab-title">Home</h3>
        <p className="tab-sub">This is the placeholder home screen for your desktop budgeting app.</p>
      </div>

      <div className="grid-two">
        <div className="card">
          <p className="card-kicker">Overview</p>
          <p className="card-body">Your accounts, budgets, and recent activity will appear here.</p>
        </div>
        <div className="card">
          <p className="card-kicker">Quick actions</p>
          <p className="card-body">Use the AI tab for future planning and recommendations.</p>
        </div>
      </div>
    </div>
  );
}
