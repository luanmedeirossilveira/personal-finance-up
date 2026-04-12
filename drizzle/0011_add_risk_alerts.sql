CREATE TABLE IF NOT EXISTS risk_alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,        -- 'installments_growth' | 'fixed_growth' | 'card_recurrence'
  severity     TEXT NOT NULL,        -- 'warning' | 'danger'
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  month        INTEGER NOT NULL,
  year         INTEGER NOT NULL,
  dismissed_at TEXT,                 -- NULL = ativo, data = dispensado
  created_at   TEXT DEFAULT (datetime('now'))
);
