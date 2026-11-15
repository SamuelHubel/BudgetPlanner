import { useCallback, useEffect, useState } from "react";
import "./index.css";
import UnlockScreen from "./features/lock/UnlockScreen";
import Dashboard from "./components/Dashboard";
import { budgetApi } from "./api/budgetApi";
import { toErrorMessage } from "./shared/errors";
import type { TabName, UnlockMethod } from "./types";

const INACTIVITY_LOCK_MS = 5 * 60 * 1000;

/** Coordinates password setup, locking, and dashboard navigation. */
function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [unlockMethod, setUnlockMethod] = useState<UnlockMethod>("password");
  const [activeTab, setActiveTab] = useState<TabName>("home");
  const [unlockError, setUnlockError] = useState("");
  const [lockError, setLockError] = useState("");

  useEffect(() => {
    let isMounted = true;
    void Promise.all([
      budgetApi.isInitialized(),
      budgetApi.unlockMethod(),
    ]).then(
      ([initialized, method]) => {
        if (isMounted) {
          setUnlockMethod(method);
          setIsInitialized(initialized);
        }
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
      if (unlockMethod === "device") {
        if (isInitialized) {
          await budgetApi.unlockWithDevice();
        } else {
          await budgetApi.createDeviceVault();
          setIsInitialized(true);
        }
      } else if (isInitialized) {
        await budgetApi.unlock(password);
      } else {
        await budgetApi.createPassword(password);
        setIsInitialized(true);
      }
      setIsLocked(false);
    } catch (error) {
      setUnlockError(toErrorMessage(error, "Unable to unlock the app."));
      return;
    }
    if (unlockMethod !== "migrate") return;
    try {
      await budgetApi.switchToDeviceUnlock();
      setUnlockMethod("device");
    } catch (error) {
      setLockError(
        toErrorMessage(error, "Unable to switch to Windows Hello unlock."),
      );
    }
  };

  const handleResetVault = async () => {
    await budgetApi.resetVault();
    setUnlockError("");
    setIsInitialized(false);
    setUnlockMethod(await budgetApi.unlockMethod());
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
            unlockMethod={unlockMethod}
            onUnlock={handleUnlock}
            onResetVault={handleResetVault}
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
