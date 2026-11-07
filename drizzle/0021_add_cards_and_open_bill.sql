-- v3: cartões como limite planejado (não entram no patrimônio líquido).
-- Cada cartão identifica suas faturas no Mês por palavras do nome (ex.: "itau", "inter")
-- e, se vier do Open Finance, pela conta de crédito sincronizada.
CREATE TABLE IF NOT EXISTS cards (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  ownership      TEXT NOT NULL DEFAULT 'mine',   -- 'mine' | 'hers' | 'joint'
  monthly_limit  REAL NOT NULL DEFAULT 0,        -- quanto se planeja usar por mês
  match_terms    TEXT NOT NULL DEFAULT '',       -- palavras separadas por vírgula
  account_id     INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now'))
);

-- Fatura em aberto do cartão sincronizado (o `balance` da Pluggy é o limite usado, com parcelas futuras).
ALTER TABLE accounts ADD COLUMN open_bill_amount REAL;
