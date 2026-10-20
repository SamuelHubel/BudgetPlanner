CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  color TEXT CHECK (
    color IS NULL OR color GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'
  )
);

CREATE TABLE import_batches (
  id INTEGER PRIMARY KEY,
  file_name TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  transaction_count INTEGER NOT NULL CHECK (transaction_count >= 0)
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT,
  date TEXT NOT NULL CHECK (
    date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'imported')),
  import_batch_id INTEGER REFERENCES import_batches(id) ON DELETE CASCADE,
  dedupe_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (typeof(amount_cents) = 'integer'),
  CHECK ((source = 'imported') = (import_batch_id IS NOT NULL))
);

CREATE UNIQUE INDEX idx_transactions_dedupe
  ON transactions(dedupe_hash) WHERE dedupe_hash IS NOT NULL;
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_batch ON transactions(import_batch_id);

CREATE TABLE goals (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  target_amount_cents INTEGER,
  target_date TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (target_amount_cents IS NULL OR typeof(target_amount_cents) = 'integer')
);

CREATE TABLE keyword_category_map (
  id INTEGER PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(keyword)) > 0),
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE ai_insights_log (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('ollama', 'rules_engine')),
  insight_type TEXT NOT NULL CHECK (insight_type IN ('observation', 'advice')),
  prompt_context TEXT,
  response_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);