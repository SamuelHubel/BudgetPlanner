import { useCallback, useEffect, useState } from "react";
import "./index.css";
import UnlockScreen from "./features/lock/UnlockScreen";
import Dashboard from "./components/Dashboard";
import { budgetApi } from "./api/budgetApi";
import { toErrorMessage } from "./shared/errors";
import type { TabName } from "./types";

const INACTIVITY_LOCK_MS = 5 * 60 * 1000;

/** Coordinates password setup, locking, and dashboard navigation. */
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
          setUnlockError(
            toErrorMessage(error, "Unable to check password setup."),
          );
          setIsInitialized(null);
        }
      },
    );
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLock = useCallback(async () => {
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
        void handleLock().then((locked) => {
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
  }, [isLocked, handleLock]);

  const handleUnlock = async (password: string) => {
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-8 flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.32em] text-slate-400">
            Budget Planner
          </p>
        </header>

        {isLocked ? (
          <UnlockScreen
            isInitialized={isInitialized}
            onUnlock={handleUnlock}
            error={unlockError}
          />
        ) : (
          <Dashboard
            api={budgetApi}
            onLock={handleLock}
            lockError={lockError}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}
      </div>
    </div>
  );
}

export default App;
