### Budget Planner

A local, AI powered (not proper financial advice!!!), Personal Finance App.
Track monthly income and expenses by loading a bank statement and using its category column when available. When a statement category is missing or unrecognized, merchant keyword rules provide a fallback. Transactions without a match stay uncategorized, and you can review or change every category before importing.
On the Home dashboard, select any tracked month to view its categorized income and expenses; the newest month is selected by default.
Build a budget for each month and compare it with actual spending, and set goals and track your progress. Asking AI for budgeting help is planned (not proper financial advice!!!)

## Starting over

Use **Start over** in the dashboard and confirm to permanently delete transactions, budgets, goals, import history, and AI insight logs. The database schema and lock data are retained.

## Scope decisions

- **Single user, local lock screen.** There are no accounts. The password derives the database encryption key, so a forgotten password means the data cannot be recovered; the only way forward is to erase it and start over.
- **File import, not live bank sync.** Bank sync would need a hosted service to hold access tokens, which conflicts with keeping all data on your machine.
- **Local AI only.** Planned AI features will use Ollama on your machine, with a rules-based fallback when it isn't running. Nothing is sent to a cloud service.

## Tech Stack

| Layer          | Choice                                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| App shell      | Tauri 2, desktop targets only for now                                                  |
| Frontend       | React + TypeScript + Vite                                                              |
| Styling        | Tailwind CSS (single desktop layout for now)                                           |
| Local database | SQLite via rusqlite in the Rust core, encrypted with SQLCipher                         |
| Key derivation | Argon2id (derive DB encryption key from the lock-screen password)                      |
| AI backend     | Planned: Ollama, called via local HTTP API (http://localhost:11434) from the Rust core |
| Fallback AI    | Planned: rules-based insight engine (no LLM), used when Ollama isn't running           |
| File import    | CSV parser for one-time/on-demand bank statement import (OFX/QFX as stretch)           |
| Charts         | Hand-built SVG and Tailwind components                                                 |
| Packaging      | Tauri CLI (tauri build) — desktop installers only                                      |

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

Frontend tests read fake password fixtures from the tracked `.env.test` file; the Rust authentication test reads its test-only fixtures from the same file. Do not put real credentials in Vite environment variables; frontend variables may be included in client builds.

Run Rust checks from `src-tauri` with `cargo fmt --check`, `cargo clippy -- -D warnings`, and `cargo test`. Rust tests cover the domain, migrations, commands, and encrypted database behavior; Rust coverage reports are not currently collected.
