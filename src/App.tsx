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
    let lastActivityAt = Date.now();
    const restartTimer = () => {
      lastActivityAt = Date.now();
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(lockNow, INACTIVITY_LOCK_MS);
    };
    const lockNow = () => {
      void handleLock().then((locked) => {
        if (!locked) restartTimer();
      });
    };
    // Timers can pause while the machine sleeps, so activity on waking must not
    // extend a limit that has already passed.
    const resetInactivityTimer = () => {
      if (Date.now() - lastActivityAt >= INACTIVITY_LOCK_MS) {
        window.clearTimeout(timeoutId);
        lockNow();
      } else {
        restartTimer();
      }
    };

    restartTimer();
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

  const handleResetVault = async () => {
    await budgetApi.resetVault();
    setUnlockError("");
    setIsInitialized(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {isLocked ? (
        <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
          <p className="mb-6 text-base font-semibold text-slate-900">
            Budget Planner
          </p>
          <UnlockScreen
            isInitialized={isInitialized}
            onUnlock={handleUnlock}
            onResetVault={handleResetVault}
            error={unlockError}
          />
        </div>
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
  );
}

export default App;
