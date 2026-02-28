-- Migration: adicionar tabela future_bills
CREATE TABLE IF NOT EXISTS future_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount REAL,
  reminder_date TEXT,
  notify_days_before INTEGER DEFAULT 3,
  notified INTEGER DEFAULT 0,
  notes TEXT,
  priority TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_future_bills_user ON future_bills(user_id);
