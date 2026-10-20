import { useState, type FormEvent } from "react";
import "./UnlockScreen.css";

type Props = {
  isInitialized: boolean | null;
  onSubmit: (password: string) => Promise<void>;
  error: string;
};

const MINIMUM_PASSWORD_LENGTH = 12;

export default function UnlockScreen({ isInitialized, onSubmit, error }: Props) {
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
    <div className="unlock-card">
      <h2 className="unlock-title">
        {isCreatingPassword ? "Create your password" : "Unlock your budget vault"}
      </h2>
      <p className="unlock-sub">
        {isCreatingPassword
          ? "Create a password to encrypt your budget data."
          : "Enter your password to continue."}
      </p>
      {error && <p className="unlock-error" role="alert">{error}</p>}
      {formError && <p className="unlock-error" role="alert">{formError}</p>}

      {isInitialized === null ? (
        <p role="status">
          {error ? "Password setup is unavailable." : "Checking password setup..."}
        </p>
      ) : (
        <form className="unlock-form" onSubmit={submitPassword}>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
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
            className="input"
          />

          {isCreatingPassword && (
            <>
              <label className="label" htmlFor="password-confirmation">
                Confirm password
              </label>
              <input
                id="password-confirmation"
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
                className="input"
              />
            </>
          )}

          <button type="submit" className="primary-btn">
            {isCreatingPassword ? "Create password" : "Unlock"}
          </button>
        </form>
      )}

      <div className="note-box">
        {isCreatingPassword && (
          <p>
            Any existing unencrypted database from an earlier version will be deleted during setup.
          </p>
        )}
        <p>
          If you forget your password, your encrypted budget data cannot be recovered.
        </p>
      </div>
    </div>
  );
}
