# CLAUDE.md

Guidance for working in this repository.

## What this is

Budget Planner is a local-first desktop personal-finance app: **Tauri 2** (Rust core in `src-tauri/`) plus a **React 19 + TypeScript + Vite + Tailwind 3** webview (`src/`). All data stays on the machine in a **SQLCipher-encrypted SQLite** database whose key comes from the user's lock-screen password via Argon2id.

What exists today: password setup/unlock/lock, CSV statement import with preview and category review, a built-in two-level category list with a keyword library, a Home dashboard (all-time and per-month summaries, charts that drill into subcategories), a Budget tab (one budget per calendar month, built in two phases, compared with actual spending), a Goals tab (free-text goals, newest first, with optional category spending limits and progress donuts), and "Start over" (reset financial data). The AI tab is a placeholder, and the Goals tab's "Help me meet this" button is a stub that only shows the planned AI disclosure. Ollama integration and the rules-based insight engine (see README) are planned and not implemented. Charts are hand-built SVG/Tailwind components, not a charting library.

## Commands

Frontend, from the repo root:

```sh
npm ci
npm run typecheck      # tsc --noEmit
npm run lint           # eslint (typescript-eslint, react-hooks, jsx-a11y)
npm run format:check   # prettier
npm test               # vitest run
npm run test:coverage
npx vitest run src/shared/format.test.ts   # single file
npm run tauri dev      # run the desktop app (Vite on fixed port 1420)
npm run tauri build    # desktop installers
```

Rust, from `src-tauri/` (or pass `--manifest-path src-tauri/Cargo.toml`):

```sh
cargo fmt --check
cargo clippy -- -D warnings
cargo test
cargo test import::    # filter by test name
```

CI (`.github/workflows/ci.yml`) runs these checks, except `tauri dev`, on pushes to `main` and on every PR. It also compiles the app (without installers) and runs `cargo test` on Windows. Clippy warnings fail the build. The first Rust build is slow because `rusqlite` compiles SQLCipher and OpenSSL from source (`bundled-sqlcipher-vendored-openssl`).

## Architecture

### Rust core (`src-tauri/src/`)

- `lib.rs`: builds the Tauri app and registers every IPC command in `generate_handler!`. **A new command must be added here**, and also to `src/api/budgetApi.ts`.
- `state.rs`: `AppState { db: Mutex<Option<Connection>> }`. `None` means locked. Commands get the connection through `commands::connection(&state)` and return `AppError::Locked` when it is `None`.
- `error.rs`: `AppError` (thiserror). It serializes to `{ code, message }`. `src/shared/errors.ts` has `toErrorMessage` for display and `errorCode` for branching; never match on message text. Add a code in `AppError::code()` when the frontend must react to a specific error.
- `commands/`: thin `#[tauri::command(async)]` wrappers. Always use the `async` form: plain sync commands run on the main thread, so key derivation, large imports, or waiting on the database mutex would freeze the window. The usual pattern: the public command locks state and calls a private `*_in_connection(&mut Connection, ...)` or `*_in(data_dir, ...)` function. Unit tests target those inner functions with an in-memory DB or a temporary directory.
  - `auth.rs`: `budget.db` and `kdf.salt` live in `<data dir>/BudgetPlanner` (`APP_DIRECTORY_NAME` in `lib.rs`), not Tauri's identifier-named `app_data_dir`. Argon2id (64 MiB, 3 iterations, 1 lane) derives a 32-byte key, applied with `PRAGMA key = "x'..'"`. The minimum password length is 12. Key material uses `zeroize`. Creating a password deletes any legacy plaintext DB. `reset_vault` erases the database and salt, and is refused while unlocked.
  - `import.rs`: `preview_import` (parse with the chosen date order and amount format, categorize, flag duplicates) and `commit_import` (one transaction with an `import_batches` row and `INSERT OR IGNORE` on `dedupe_hash`).
  - `goals.rs`: `list_goals` (newest first by `id DESC`), `create_goal`, `update_goal`, `delete_goal`. A goal may link an expense category plus a monthly limit (stored in `target_amount_cents`). Progress is net spending in that category for the **latest month with any transaction**, not the calendar month.
  - `budget.rs`: `get_budget` (the month's budget, the nearest earlier budget as a copy-forward `template` when it has none, and actuals), `save_budget` (upsert in one transaction, replacing allocations; zero allocations are not stored), `delete_budget`. Unlike goals, actuals cover the **selected** month. Allocations may exceed income; the UI warns but does not block.
  - `categories.rs`: `list_categories` and `list_subcategories`. Subcategories are a built-in list with no editing commands.
  - `summary.rs`, `settings.rs` (currency and `CategorySettings`, stored as `'true'`/`'false'` rows in `settings`), `maintenance.rs` (`reset_financial_data`, atomic).
- `domain/`: pure logic with no DB or Tauri. This is where most of the unit tests live.
  - `csv_import.rs`: header detection, 5 MiB / 50,000-row limits.
  - `money.rs`: parses amounts into **integer cents** and handles locale separators (ambiguous values return `AmbiguousAmount`).
  - `dates.rs`: `DateOrder::{Auto, Mdy, Dmy}`. Auto infers the order and returns `AmbiguousDateOrder`, which makes the UI ask the user.
  - `categorize.rs`: precedence is statement label (case-insensitive match against main categories, then against subcategory names that are unique across categories), then the longest whole-word keyword rule from `keyword_category_map`, then uncategorized for the user to choose. A label that names only a main category can still gain a subcategory from a keyword rule under that same category. Rules run as one `RegexSet`.
  - `hash.rs`: SHA-256 over length-prefixed (date, cents, normalized description, occurrence index). The occurrence index keeps genuinely repeated rows in one file distinct.
  - `summary.rs`: all-time and monthly breakdowns with checked arithmetic (`NumericOverflow`).
  - `budget.rs`: month format, input modes, and budget amount validation.
  - `goals.rs`: goal text normalization (max 500 chars), the both-or-neither category/limit rule, and net-to-spent conversion.
- `db/mod.rs`: hand-rolled migrations tracked by `PRAGMA user_version`. Each migration runs in its own immediate transaction. The code refuses an untracked existing schema or a newer version.

### Database (`src-tauri/migrations/`)

Numbered SQL files are embedded with `include_str!` in `db/mod.rs::MIGRATIONS`. **To add a migration**, create `000N_*.sql` and append `(N, include_str!(...))`. Never edit a shipped migration. Update the version assertion in the `db` tests. The schema relies on CHECK constraints: integer-only `amount_cents`, `YYYY-MM-DD` dates, `source = 'imported'` exactly when `import_batch_id` is set, and `#rrggbb` colors. `transactions.category_id` is always the main category and `subcategory_id` is an optional refinement, so budgets and goals stay at main-category level and need no roll-up. Triggers reject a subcategory whose parent differs from the row's `category_id`; they deliberately do not watch `category_id`, because that would abort category deletes. Deleting a category sets transaction and goal categories to NULL. Deleting an import batch cascades to its transactions.

### Frontend (`src/`)

- `App.tsx`: lock state, first-run password creation vs. unlock, and **auto-lock after 5 minutes of inactivity**.
- `api/budgetApi.ts`: the `BudgetApiClient` interface and the Tauri `invoke` implementation. Components receive `api` as a prop (dependency injection), so tests pass a fake client instead of mocking Tauri. `budgetApi.test.ts` pins the exact command names and camelCase payloads.
- `types/index.ts`: TS mirrors of the Rust serde types. Rust structs use `#[serde(rename_all = "camelCase")]`. Keep the two sides in sync.
- `components/Dashboard.tsx`: tab shell (`TABS = ["home", "budget", "goals", "ai"]`). Only the active panel mounts, so a tab reloads its data each time it opens.
- `features/<area>/`: feature folders (`home`, `budget`, `goals`, `import`, `lock`, `settings`, `ai`). State lives in hooks (`useImportFlow`, `useFinancialSummary`, `useGoals`, `useBudget`) and in `FinancialSummaryContext`, which provides the summary, currency, and `refresh()`.
- `features/budget/budgetMath.ts`: pure budget math. Cents are the only stored value and percents are derived. `percentToCents` rounds down so 100% never exceeds income, and sliders step by 0.5%.
- `features/home/SummaryDonut.tsx`: chooses the main or subcategory view and renders it through `DonutPanel.tsx`. `FinancialSummaryContext` also holds `categorySettings` and `updateCategorySettings`.
- `shared/`: `Button`, `TabBar`, `Dialog` (native `<dialog>`, polyfilled in `setupTests.ts`), `ConfirmDialog` (destructive confirmations, with busy and error state), `Alert`, `Donut` (SVG primitives for the chart wrappers), `errors.ts`, `parseAmountInput.ts`, and `format.ts` (currency/cents formatting).

## Conventions and gotchas

- **Money is always signed integer cents** (`i64` / `number`): income is positive and expenses are negative. Never use floats. Amounts crossing IPC must fit in JS `Number.MAX_SAFE_INTEGER`; `commands::validate_safe_cents` enforces that.
- Dates cross IPC as ISO `YYYY-MM-DD` strings. Months are `YYYY-MM`.
- Rust items carry `///` doc comments, and TS exports carry `/** */` JSDoc. Match that.
- Tests: Vitest + Testing Library + jsdom, colocated as `*.test.ts(x)` or under `src/__tests__/`. Rust tests are `#[cfg(test)] mod tests` in the same file, and use `db::migrated_connection()` for an in-memory database.
- Test passwords come from the tracked `.env.test`: `VITE_TEST_*` for the frontend through `src/__tests__/testCredentials.ts`, and `BUDGET_PLANNER_TEST_*` for Rust `auth.rs` tests. Never hardcode passwords in tests and never put real secrets in `VITE_*` variables (they can be bundled into the client).
- The Tauri CSP (`tauri.conf.json`) only allows `self`/IPC. Any future network access, such as Ollama on `localhost:11434`, belongs in the Rust core, not in webview `fetch`.
- Capabilities (`src-tauri/capabilities/default.json`) grant only `core:default`. No Tauri plugins are installed yet.
