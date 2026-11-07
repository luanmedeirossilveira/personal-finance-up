-- v3 / Fase 2: transações bancárias (Pluggy, importação OFX/CSV) e conciliação com as contas.
CREATE TABLE IF NOT EXISTS bank_transactions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id           INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  source               TEXT NOT NULL,                  -- 'pluggy' | 'import'
  -- Chave de idempotência: id da Pluggy, FITID do OFX ou hash de data+valor+descrição (CSV).
  external_id          TEXT NOT NULL,
  date                 TEXT NOT NULL,                  -- YYYY-MM-DD
  amount               REAL NOT NULL,                  -- negativo = saída, positivo = entrada
  description          TEXT NOT NULL,
  category             TEXT,
  ownership            TEXT NOT NULL DEFAULT 'mine',
  -- 'pending' (a categorizar) | 'suggested' (casou com uma conta, aguarda confirmação)
  -- | 'matched' (confirmada) | 'categorized' | 'ignored'
  status               TEXT NOT NULL DEFAULT 'pending',
  bill_id              INTEGER REFERENCES bills(id) ON DELETE SET NULL,
  card_transaction_id  INTEGER REFERENCES card_transactions(id) ON DELETE SET NULL,
  created_at           TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_status ON bank_transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_date ON bank_transactions(user_id, date);
