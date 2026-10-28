CREATE TABLE settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL
);

INSERT INTO settings (setting_key, setting_value)
VALUES ('currency', 'USD');
