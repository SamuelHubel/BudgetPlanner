# Budget Planner

A local-first desktop app for personal budgeting. Import your bank statements, see where your money went, plan each month, and track your goals. Everything stays on your machine in an encrypted database, with no accounts and no cloud service.

> Budget Planner is not financial advice. This includes the AI features planned for later.

## Features

- **Encrypted storage.** Your lock-screen password derives the key for a SQLCipher-encrypted database. The app locks itself after 5 minutes of inactivity.
- **CSV statement import.** Preview every row, change any category, and skip duplicates before anything is saved.
- **Home dashboard.** See all-time and per-month income and expenses by category, with charts. The newest month is selected by default.
- **Monthly budgets.** Build one budget per calendar month, start from your most recent earlier budget, and compare it with actual spending. Allocating more than your income shows a warning but is allowed.
- **Goals.** Write free-text goals and optionally link one to an expense category with a monthly limit. Progress is measured against the most recent month that has transactions.

### Not built yet

The AI tab is a placeholder, and the **Help me meet this** button on a goal only shows what the feature will disclose. Local AI through Ollama and a rules-based fallback are planned.

## Importing statements

Export a CSV from your bank and import it from the Home tab. Files can be up to 5 MiB and 50,000 rows, and may be comma, semicolon, or tab delimited.

The header row needs a date column, a description column, and either an amount column or debit and credit columns. These names are recognized, ignoring case and spacing:

| Column      | Accepted names                                                              |
| ----------- | --------------------------------------------------------------------------- |
| Date        | Date, Transaction Date, Posted Date, Value Date                             |
| Description | Description, Details, Memo, Payee, Transaction Description                  |
| Amount      | Amount, Transaction Amount                                                  |
| Debit       | Debit, Withdrawal                                                           |
| Credit      | Credit, Deposit                                                             |
| Category    | Category, Category Name, Transaction Category, Spending Category (optional) |

Each transaction is categorized in this order:

1. The statement's category, if it matches one of your categories.
2. A merchant keyword rule, using the longest whole-word match.
3. Otherwise it stays uncategorized.

If dates or amounts are ambiguous, the app asks which format your statement uses instead of guessing. Importing an overlapping statement is safe, because transactions that were already imported are skipped.

## Your data

- **Location.** `budget.db` and `kdf.salt` live in the app data directory. On Windows, that is `%APPDATA%\BudgetPlanner`.
- **Forgotten passwords.** The password is the encryption key, so there is no recovery. **Forgot your password?** on the unlock screen erases the data so you can create a new password.
- **Start over.** This button on the dashboard permanently deletes transactions, budgets, goals, import history, and AI insight logs. Your password, categories, and keyword rules are kept.

## Scope decisions

- **Single user, local lock screen.** There are no accounts, so there is no one who can reset a password for you.
- **File import, not live bank sync.** Bank sync would need a hosted service to hold access tokens, which conflicts with keeping all data on your machine.
- **Local AI only.** Planned AI features will run through Ollama on your machine, with a rules-based fallback when it isn't running. Nothing will be sent to a cloud service.

## Tech stack

| Layer          | Choice                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------- |
| App shell      | Tauri 2, desktop targets only                                                               |
| Frontend       | React 19, TypeScript, Vite                                                                  |
| Styling        | Tailwind CSS 3, single desktop layout                                                       |
| Local database | SQLite through rusqlite in the Rust core, encrypted with SQLCipher                          |
| Key derivation | Argon2id                                                                                    |
| File import    | CSV parser in the Rust core (OFX/QFX is a stretch goal)                                     |
| Charts         | Hand-built SVG and Tailwind components                                                      |
| Packaging      | Tauri CLI, desktop installers only                                                          |
| AI backend     | Planned: Ollama, called from the Rust core through its local API (`http://localhost:11434`) |
| Fallback AI    | Planned: rules-based insight engine with no LLM                                             |

## Getting started

You need:

- Node.js 22
- The stable Rust toolchain
- The [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) for your operating system
- Perl, which is used to compile the bundled OpenSSL

Then, from the repository root:

```sh
npm ci
npm run tauri dev      # run the app
npm run tauri build    # build desktop installers
```

The first Rust build is slow because SQLCipher and OpenSSL are compiled from source.

## Development checks

CI runs these on pushes to `main` and on every pull request, and also builds and tests on Windows. Clippy warnings fail the build.

Frontend, from the repository root:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:coverage
```

Rust, from `src-tauri/`:

```sh
cargo fmt --check
cargo clippy -- -D warnings
cargo test
```

Rust tests cover the domain logic, migrations, commands, and encrypted database behavior. Rust coverage reports are not collected.

Tests read fake password fixtures from the tracked `.env.test` file. Do not put real credentials in `VITE_*` variables, because they can be included in client builds.

See [CLAUDE.md](CLAUDE.md) for the architecture and code conventions.
