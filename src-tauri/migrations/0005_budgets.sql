CREATE TABLE budgets (
  id INTEGER PRIMARY KEY,
  month TEXT NOT NULL UNIQUE CHECK (
    month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
  ),
  expected_income_cents INTEGER NOT NULL CHECK (
    typeof(expected_income_cents) = 'integer' AND expected_income_cents > 0
  ),
  input_mode TEXT NOT NULL CHECK (input_mode IN ('percent', 'amount')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE budget_allocations (
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (
    typeof(amount_cents) = 'integer' AND amount_cents > 0
  ),
  PRIMARY KEY (budget_id, category_id)
);
