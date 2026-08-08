// This component will be used to display all of the AI features in the app
// will send requests taken from chat box to the backend to be processsed by the AI or rules-based engine

import "./HomeTab.css";

export default function AITab() {
  return (
    <div className="tab-content">
      <div className="stack">
        <h3 className="tab-title">AI</h3>
        <p className="tab-sub">AI features are coming soon. This placeholder screen shows where model-driven insights will appear.</p>
      </div>

      <div className="card">
        <p className="card-body">Placeholder for chat, recommendations, and generated budget suggestions.</p>
      </div>
    </div>
  );
}
