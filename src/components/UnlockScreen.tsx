// This component will be used to display the unlock screen for the app
// Users must enter a password to unlock the app
// For now not encrypted, and any characters are valid

import { type FormEvent } from "react";
import "./UnlockScreen.css";

type Props = {
  password: string;
  setPassword: (v: string) => void;
  unlockApp: (e: FormEvent<HTMLFormElement>) => Promise<void>;
};

export default function UnlockScreen({ password, setPassword, unlockApp }: Props) {
  return (
    <div className="unlock-card">
      <h2 className="unlock-title">Unlock your budget vault</h2>
      <p className="unlock-sub">Enter your password to continue. Database encryption and password storage are not implemented yet.</p>

      <form className="unlock-form" onSubmit={unlockApp}>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          placeholder="Enter your password"
          className="input"
        />

        <button type="submit" className="primary-btn">
          Unlock
        </button>
      </form>

      <div className="note-box">TODO: add password hashing, key derivation, and SQLCipher database encryption.</div>
    </div>
  );
}
