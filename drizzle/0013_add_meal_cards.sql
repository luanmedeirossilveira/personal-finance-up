-- Migration: Cartões de alimentação (vale-refeição / vale-alimentação)
-- Controle mensal do limite do cartão e do extrato de compras.
-- NÃO interfere em renda, contas ou saldo — tabelas isoladas, apenas para controle.

CREATE TABLE IF NOT EXISTS meal_cards (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  limit_amount  REAL NOT NULL DEFAULT 0,
  color         TEXT DEFAULT '#5ab28d',
  month         INTEGER NOT NULL,
  year          INTEGER NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meal_cards_user_id ON meal_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_cards_month_year ON meal_cards(month, year);

CREATE TABLE IF NOT EXISTS meal_card_transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_card_id  INTEGER NOT NULL REFERENCES meal_cards(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  amount        REAL NOT NULL,
  category      TEXT,
  date          TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meal_card_transactions_card_id ON meal_card_transactions(meal_card_id);
