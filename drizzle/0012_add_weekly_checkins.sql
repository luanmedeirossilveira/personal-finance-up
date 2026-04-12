CREATE TABLE IF NOT EXISTS weekly_checkins (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_number  INTEGER NOT NULL,   -- semana ISO do ano (1–53)
  month        INTEGER NOT NULL,
  year         INTEGER NOT NULL,
  type         TEXT NOT NULL DEFAULT 'weekly',  -- 'weekly' | 'monthly'
  -- respostas serializadas em JSON:
  -- { answers: [{question, answer}], decision?: string, highlight?: string, improvement?: string }
  data         TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, week_number, year, type)
);
