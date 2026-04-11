-- Criar nova tabela history_debts
CREATE TABLE history_debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  debt_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_history_debts_user ON history_debts(user_id);
CREATE INDEX IF NOT EXISTS idx_history_debts_debt ON history_debts(debt_id);

-- Adicionar nova coluna paid_amount em debts
ALTER TABLE debts ADD COLUMN paid_amount REAL DEFAULT 0;

-- Remover colunas antigas de debts
ALTER TABLE debts DROP COLUMN amount;
ALTER TABLE debts DROP COLUMN due_date;