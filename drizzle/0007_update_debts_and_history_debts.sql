-- ============================================================
-- MIGRATION: debts v2
-- ============================================================

-- 1. Recriar debts com a nova estrutura (SQLite não suporta ADD + DROP na mesma migration facilmente)
CREATE TABLE debts_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  amount      REAL    NOT NULL DEFAULT 0,  -- valor atual da dívida
  paid_amount REAL    NOT NULL DEFAULT 0,  -- soma histórica de tudo que foi pago
  is_paid     INTEGER NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- Copia dados existentes (paid_amount zerado pois antes não existia)
INSERT INTO debts_new (id, user_id, name, amount, paid_amount, is_paid, notes, created_at)
SELECT id, user_id, name,
  COALESCE(amount, 0),  -- se já existia a coluna; senão troque por 0
  COALESCE(paid_amount, 0),
  COALESCE(is_paid, 0),
  notes,
  created_at
FROM debts;

DROP TABLE debts;
ALTER TABLE debts_new RENAME TO debts;

CREATE INDEX IF NOT EXISTS idx_debts_user ON debts(user_id);

-- ============================================================
-- 2. Recriar history_debts como histórico de renegociações
-- ============================================================
DROP TABLE IF EXISTS history_debts;

CREATE TABLE history_debts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  debt_id         INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  previous_amount REAL    NOT NULL,
  new_amount      REAL    NOT NULL,
  reason          TEXT,                          -- motivo da renegociação
  changed_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_history_debts_user ON history_debts(user_id);
CREATE INDEX IF NOT EXISTS idx_history_debts_debt ON history_debts(debt_id);

-- ============================================================
-- 3. Nova tabela: vínculo entre dívida e bill (mês pago)
-- ============================================================
CREATE TABLE IF NOT EXISTS debt_bill_links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  debt_id    INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  bill_id    INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(debt_id, bill_id)   -- não duplicar vínculo
);

CREATE INDEX IF NOT EXISTS idx_debt_bill_links_debt ON debt_bill_links(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_bill_links_bill ON debt_bill_links(bill_id);