import { useCallback, useEffect, useState } from "react";
import "./index.css";
import UnlockScreen from "./components/UnlockScreen";
import Dashboard from "./components/Dashboard";
import { budgetApi } from "./api/budgetApi";
import { toErrorMessage } from "./lib/errors";

type TabName = "home" | "ai";

const INACTIVITY_LOCK_MS = 5 * 60 * 1000;

function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>("home");
  const [unlockError, setUnlockError] = useState("");
  const [lockError, setLockError] = useState("");

  useEffect(() => {
    let isMounted = true;
    void budgetApi.isInitialized().then(
      (initialized) => {
        if (isMounted) setIsInitialized(initialized);
      },
      (error: unknown) => {
        if (isMounted) {
          setUnlockError(toErrorMessage(error, "Unable to check password setup."));
          setIsInitialized(null);
        }
      },
    );
    return () => {
      isMounted = false;
    };
  }, []);

  const lockApp = useCallback(async () => {
    try {
      await budgetApi.lock();
      setIsLocked(true);
      setLockError("");
      return true;
    } catch (error) {
      setLockError(toErrorMessage(error, "Unable to lock the app."));
      return false;
    }
  }, []);

  useEffect(() => {
    if (isLocked) return;

    let timeoutId: number;
    const resetInactivityTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void lockApp().then((locked) => {
          if (!locked) resetInactivityTimer();
        });
      }, INACTIVITY_LOCK_MS);
    };

    resetInactivityTimer();
    window.addEventListener("mousemove", resetInactivityTimer);
    window.addEventListener("mousedown", resetInactivityTimer);
    window.addEventListener("wheel", resetInactivityTimer);
    window.addEventListener("keydown", resetInactivityTimer);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("mousemove", resetInactivityTimer);
      window.removeEventListener("mousedown", resetInactivityTimer);
      window.removeEventListener("wheel", resetInactivityTimer);
      window.removeEventListener("keydown", resetInactivityTimer);
    };
  }, [isLocked, lockApp]);

  const submitPassword = async (password: string) => {
    setUnlockError("");
    try {
      if (isInitialized) {
        await budgetApi.unlock(password);
      } else {
        await budgetApi.createPassword(password);
        setIsInitialized(true);
      }
      setIsLocked(false);
    } catch (error) {
      setUnlockError(toErrorMessage(error, "Unable to unlock the app."));
    }
  };

  return (
    <div className="app-shell">
      <div className="container">
        <header className="header">
          <p className="brand-kicker">Budget Planner</p>
        </header>

        {isLocked ? (
          <UnlockScreen
            isInitialized={isInitialized}
            onSubmit={submitPassword}
            error={unlockError}
          />
        ) : (
          <Dashboard
            api={budgetApi}
            lockApp={lockApp}
            lockError={lockError}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        )}
      </div>
    </div>
  );
}

export default App;
