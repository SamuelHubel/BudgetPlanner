-- Single local user / lock screen
CREATE TABLE app_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- enforce single row
  password_hash TEXT NOT NULL,           -- Argon2id hash, for login check
  kdf_salt TEXT NOT NULL,                -- salt used to derive the DB encryption key
  created_at TEXT NOT NULL
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT
);

CREATE TABLE import_batches (
  id INTEGER PRIMARY KEY,
  file_name TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  transaction_count INTEGER NOT NULL
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id),
  amount REAL NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'imported')),
  import_batch_id INTEGER REFERENCES import_batches(id),
  created_at TEXT NOT NULL
);

CREATE TABLE goals (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  target_amount REAL,
  target_date TEXT,
  category_id INTEGER REFERENCES categories(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TEXT NOT NULL
);

CREATE TABLE keyword_category_map (
  id INTEGER PRIMARY KEY,
  keyword TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id)
);

CREATE TABLE ai_insights_log (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('ollama', 'rules_engine')),
  insight_type TEXT NOT NULL CHECK (insight_type IN ('observation', 'advice')),
  prompt_context TEXT,
  response_text TEXT NOT NULL,
  created_at TEXT NOT NULL
);