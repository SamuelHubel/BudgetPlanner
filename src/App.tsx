// This is the main entry point for the app. 
// It will display the unlock screen if the app is locked,
//  and the dashboard if the app is unlocked.


import { useState, type FormEvent } from "react";
import "./index.css";
import UnlockScreen from "./components/UnlockScreen";
import Dashboard from "./components/Dashboard";
import { budgetApi } from "./api/budgetApi";
import { toErrorMessage } from "./lib/errors";

type TabName = "home" | "ai";

function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<TabName>("home");
  const [unlockError, setUnlockError] = useState("");

  const unlockApp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUnlockError("");
    // TODO: implement password hashing/verification and key derivation.
    // For now, this just opens the (unencrypted) connection so migrations
    // run and CRUD milestones have something to build against.
    try {
      await budgetApi.unlock(password);
      setIsLocked(false);
      setPassword("");
    } catch (error) {
      setUnlockError(toErrorMessage(error, "Unable to unlock the app."));
    }
  };

  const lockApp = async () => {
    await budgetApi.lock();
    setIsLocked(true);
  };

  return (
    <div className="app-shell">
      <div className="container">
        <header className="header">
          <p className="brand-kicker">Budget Planner</p>
        </header>

        {isLocked ? (
          <UnlockScreen
            password={password}
            setPassword={setPassword}
            unlockApp={unlockApp}
            error={unlockError}
          />
        ) : (
          <Dashboard
            api={budgetApi}
            lockApp={lockApp}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        )}
      </div>
    </div>
  );
}

export default App;
