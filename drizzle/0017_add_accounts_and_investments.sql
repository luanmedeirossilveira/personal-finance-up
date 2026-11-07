-- v3 / Fase 2: Patrimônio — contas, investimentos, conexões Pluggy e retratos do patrimônio.

-- Conexões do MeuPluggy (Open Finance). Guardamos só o itemId; segredos ficam no env da Vercel.
CREATE TABLE IF NOT EXISTS pluggy_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id         TEXT NOT NULL UNIQUE,
  connector_name  TEXT,
  status          TEXT,
  last_sync_at    TEXT,
  last_error      TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Contas: corrente, poupança, cartão, alimentação e investimento. Pluggy ou manual.
CREATE TABLE IF NOT EXISTS accounts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL DEFAULT 'checking', -- 'checking' | 'savings' | 'credit' | 'meal' | 'investment'
  institution        TEXT,
  number             TEXT,                             -- final do número (ex.: 4 últimos dígitos do cartão)
  balance            REAL NOT NULL DEFAULT 0,
  ownership          TEXT NOT NULL DEFAULT 'mine',     -- 'mine' | 'hers' | 'joint'
  source             TEXT NOT NULL DEFAULT 'manual',   -- 'manual' | 'pluggy'
  pluggy_account_id  TEXT UNIQUE,
  pluggy_item_id     TEXT,
  bill_closing_date  TEXT,                             -- cartões: fechamento da fatura (Pluggy)
  bill_due_date      TEXT,                             -- cartões: previsão de vencimento (Pluggy)
  last_sync_at       TEXT,
  last_import_at     TEXT,                             -- última importação OFX/CSV
  archived           INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT DEFAULT (datetime('now'))
);

-- Posições de investimento (CDB, Tesouro, LCI/LCA, fundo, ação, previdência).
CREATE TABLE IF NOT EXISTS investments (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id            INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'outro', -- 'cdb' | 'tesouro' | 'lci_lca' | 'fundo' | 'acao' | 'previdencia' | 'outro'
  applied_amount        REAL NOT NULL DEFAULT 0,
  balance               REAL NOT NULL DEFAULT 0,
  due_date              TEXT,
  source                TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'pluggy'
  pluggy_investment_id  TEXT UNIQUE,
  created_at            TEXT DEFAULT (datetime('now')),
  updated_at            TEXT DEFAULT (datetime('now'))
);

-- Retrato diário do patrimônio (gerado pelo cron e pela Revisão).
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date               TEXT NOT NULL,                    -- YYYY-MM-DD
  accounts_total     REAL NOT NULL DEFAULT 0,
  investments_total  REAL NOT NULL DEFAULT 0,
  debts_total        REAL NOT NULL DEFAULT 0,
  net_worth          REAL NOT NULL DEFAULT 0,
  created_at         TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

-- Aporte mensal: conta da categoria investimentos vinculada a um investimento.
ALTER TABLE bills ADD COLUMN investment_id INTEGER REFERENCES investments(id) ON DELETE SET NULL;
