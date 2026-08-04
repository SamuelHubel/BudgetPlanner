import { useState, type FormEvent } from "react";
import "./index.css";
import "./app.css";
import UnlockScreen from "./components/UnlockScreen";
import Dashboard from "./components/Dashboard";
import { getDb, closeDb } from "./lib/db";

type TabName = "home" | "ai";

function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<TabName>("home");

  const unlockApp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: implement password hashing/verification and key derivation.
    // For now, this just opens the (unencrypted) connection so migrations
    // run and CRUD milestones have something to build against.
    await getDb();
    setIsLocked(false);
    setPassword("");
  };

  const lockApp = async () => {
    await closeDb();
    setIsLocked(true);
  };

  return (
    <div className="app-shell">
      <div className="container">
        <header className="header">
          <div>
            <p className="brand-kicker">Budget Planner</p>
            <h1 className="brand-title">Secure desktop budget app</h1>
          </div>
          <div className="tech-badge">Tauri + React + Tailwind</div>
        </header>

        {isLocked ? (
          <UnlockScreen password={password} setPassword={setPassword} unlockApp={unlockApp} />
        ) : (
          <Dashboard lockApp={lockApp} activeTab={activeTab} setActiveTab={setActiveTab} />
        )}
      </div>
    </div>
  );
}

export default App;