-- Migration: Itens (produtos) das compras de cartão alimentação
-- Cada compra (meal_card_transactions) pode ter vários produtos, como o extrato
-- de uma nota/cupom. Preenchido manualmente ou pela leitura de imagem via Claude.

CREATE TABLE IF NOT EXISTS meal_card_transaction_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id  INTEGER NOT NULL REFERENCES meal_card_transactions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  quantity        REAL NOT NULL DEFAULT 1,
  unit_price      REAL,
  amount          REAL NOT NULL,
  category        TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meal_card_transaction_items_tx_id
  ON meal_card_transaction_items(transaction_id);
