import { useState, type FormEvent } from "react";
import "./index.css";

type TabName = "home" | "ai";

function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<TabName>("home");

  const unlockApp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: implement password hashing and verification logic.
    setIsLocked(false);
    setPassword("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-slate-400">Budget Planner</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Secure desktop budget app</h1>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-400">
            Tauri + React + Tailwind
          </div>
        </header>

        {isLocked ? (
          <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-xl shadow-slate-950/30">
            <h2 className="text-2xl font-semibold text-white">Unlock your budget vault</h2>
            <p className="mt-2 text-sm text-slate-400">
              Enter your password to continue. Database encryption and password storage are not implemented yet.
            </p>

            <form className="mt-8 space-y-5" onSubmit={unlockApp}>
              <label className="block text-sm font-medium text-slate-300" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                placeholder="Enter your password"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-1 ring-slate-800 transition focus:border-slate-400 focus:ring-slate-500"
              />

              <button
                type="submit"
                className="inline-flex w-full justify-center rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Unlock
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-dashed border-slate-700 bg-slate-950/80 p-4 text-xs text-slate-500">
              TODO: add password hashing, key derivation, and SQLCipher database encryption.
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/40">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.32em] text-slate-400">Welcome back</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Your budget dashboard</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1">Locked mode</span>
                <button
                  type="button"
                  onClick={() => setIsLocked(true)}
                  className="rounded-2xl bg-slate-800 px-3 py-2 text-slate-300 transition hover:bg-slate-700"
                >
                  Lock app
                </button>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/90">
              <div className="flex border-b border-slate-800 bg-slate-900/90 p-2">
                {(["home", "ai"] as TabName[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      activeTab === tab
                        ? "bg-slate-100 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    }`}
                  >
                    {tab === "home" ? "Home" : "AI"}
                  </button>
                ))}
              </div>

              <div className="p-6 text-slate-200">
                {activeTab === "home" ? (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-white">Home</h3>
                    <p className="text-sm text-slate-400">
                      This is the placeholder home screen for your desktop budgeting app.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
                        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Overview</p>
                        <p className="mt-3 text-sm text-slate-300">Your accounts, budgets, and recent activity will appear here.</p>
                      </div>
                      <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
                        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Quick actions</p>
                        <p className="mt-3 text-sm text-slate-300">Use the AI tab for future planning and recommendations.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-white">AI</h3>
                    <p className="text-sm text-slate-400">
                      AI features are coming soon. This placeholder screen shows where model-driven insights will appear.
                    </p>
                    <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
                      <p className="text-sm text-slate-300">Placeholder for chat, recommendations, and generated budget suggestions.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
