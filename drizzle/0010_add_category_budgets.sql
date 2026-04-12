CREATE TABLE IF NOT EXISTS category_budgets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  amount      REAL NOT NULL DEFAULT 0,
  month       INTEGER NOT NULL,
  year        INTEGER NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, category, month, year)
);
