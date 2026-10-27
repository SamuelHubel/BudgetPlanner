### Budget Planner

A local, AI powered (not proper financial advice!!!), Personal Finance App.
Track monthly income, expenses, and more through manual logging or load a statement and use its category column when available. When a statement category is missing or unrecognized, merchant keyword rules provide a fallback. Transactions without a match stay uncategorized, and you can review or change every category before importing.
On the Home dashboard, select any tracked month to view its categorized income and expenses; the newest month is selected by default.
Set goals and trak your progress, or also ask AI to help budget (not proper financial advice!!!)

## Starting over

Use **Start over** in the dashboard and confirm to permanently delete transactions, goals, import history, and AI insight logs. The database schema and lock data are retained.

## Tech Stack

| Layer          | Choice                                                                            |
| -------------- | --------------------------------------------------------------------------------- |
| App shell      | Tauri 2, desktop targets only for now                                             |
| Frontend       | React + TypeScript + Vite                                                         |
| Styling        | Tailwind CSS (single desktop layout for now — see Section 10 for responsive work) |
| Local database | SQLite via tauri-plugin-sql, encrypted with SQLCipher                             |
| Key derivation | Argon2id (derive DB encryption key from the lock-screen password)                 |
| AI backend     | Ollama, called via local HTTP API (http://localhost:11434) from the Rust core     |
| Fallback AI    | Rules-based insight engine (no LLM), used when Ollama isn't running               |
| File import    | CSV parser for one-time/on-demand bank statement import (OFX/QFX as stretch)      |
| Charts         | Recharts                                                                          |
| Packaging      | Tauri CLI (tauri build) — desktop installers only                                 |

## Development checks

Run the frontend quality gates and tests from the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:coverage
```

Frontend tests read fake password fixtures from the tracked `.env.test` file. Do not put real credentials in Vite environment variables; frontend variables may be included in client builds.

Run Rust checks from `src-tauri` with `cargo fmt --check`, `cargo clippy -- -D warnings`, and `cargo test`. Rust tests cover the domain, migrations, commands, and encrypted database behavior; Rust coverage reports are not currently collected.
