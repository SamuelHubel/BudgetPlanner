import { useState, type FormEvent } from "react";

type UnlockScreenProps = {
  isInitialized: boolean | null;
  onSubmit: (password: string) => Promise<void>;
  error: string;
};

const MINIMUM_PASSWORD_LENGTH = 12;

export default function UnlockScreen({ isInitialized, onSubmit, error }: UnlockScreenProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [formError, setFormError] = useState("");
  const isCreatingPassword = isInitialized === false;

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (isCreatingPassword && password !== confirmation) {
      setFormError("The passwords do not match.");
      setPassword("");
      setConfirmation("");
      return;
    }
    try {
      await onSubmit(password);
    } finally {
      setPassword("");
      setConfirmation("");
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-xl shadow-slate-950/30">
      <h2 className="text-2xl font-semibold text-white">{isCreatingPassword ? "Create your password" : "Unlock your budget vault"}</h2>
      <p className="mt-2 text-sm text-slate-400">
        {isCreatingPassword ? "Create a password to encrypt your budget data." : "Enter your password to continue."}
      </p>
      {error && <p className="mt-4 text-sm text-red-300" role="alert">{error}</p>}
      {formError && <p className="mt-4 text-sm text-red-300" role="alert">{formError}</p>}
      {isInitialized === null ? (
        <p role="status">{error ? "Password setup is unavailable." : "Checking password setup..."}</p>
      ) : (
        <form className="mt-8 space-y-5" onSubmit={submitPassword}>
          <label className="block text-sm font-medium text-slate-300" htmlFor="password">Password</label>
          <input
            id="password"
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-1 ring-slate-800 transition focus:border-slate-400 focus:ring-slate-500"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.currentTarget.value);
              setFormError("");
            }}
            placeholder={isCreatingPassword ? "Create a password" : "Enter your password"}
            autoComplete={isCreatingPassword ? "new-password" : "current-password"}
            autoFocus
            required
            minLength={isCreatingPassword ? MINIMUM_PASSWORD_LENGTH : undefined}
          />
          {isCreatingPassword && (
            <>
              <label className="block text-sm font-medium text-slate-300" htmlFor="password-confirmation">Confirm password</label>
              <input
                id="password-confirmation"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-1 ring-slate-800 transition focus:border-slate-400 focus:ring-slate-500"
                type="password"
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.currentTarget.value);
                  setFormError("");
                }}
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
                minLength={MINIMUM_PASSWORD_LENGTH}
              />
            </>
          )}
          <button type="submit" className="inline-flex w-full justify-center rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400">
            {isCreatingPassword ? "Create password" : "Unlock"}
          </button>
        </form>
      )}
      <div className="mt-6 rounded-2xl border border-dashed border-slate-700 bg-slate-950/80 p-4 text-xs text-slate-500">
        {isCreatingPassword && <p>Any existing unencrypted database from an earlier version will be deleted during setup.</p>}
        <p>If you forget your password, your encrypted budget data cannot be recovered.</p>
      </div>
    </div>
  );
}
