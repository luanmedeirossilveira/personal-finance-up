-- v3 / Fase 3: insights da semana (regras + Gemini) com voto útil / não útil.
CREATE TABLE IF NOT EXISTS insights (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_number  INTEGER NOT NULL,                       -- semana ISO em que foi gerado
  year         INTEGER NOT NULL,                       -- ano ISO
  type         TEXT NOT NULL,                          -- 'category_pace' | 'new_subscription' | 'installments' | 'debt_payoff' | 'decision' | 'runway' | risco
  tone         TEXT NOT NULL DEFAULT 'warning',        -- 'positive' | 'warning' | 'negative'
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  action       TEXT,
  facts        TEXT NOT NULL DEFAULT '{}',             -- JSON com os números que sustentam o insight
  source       TEXT NOT NULL DEFAULT 'rules',          -- 'rules' | 'ai'
  rank         INTEGER NOT NULL DEFAULT 0,
  vote         INTEGER,                                -- 1 útil | -1 não útil | NULL
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_insights_user_week ON insights(user_id, year, week_number);
