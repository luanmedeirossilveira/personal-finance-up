-- Migration: Itens (produtos) das compras de cartão de crédito
-- Cada transação (card_transactions) pode ter vários produtos, como o extrato
-- de uma nota/cupom. Preenchido manualmente ou pela leitura de imagem via IA.
-- Espelha meal_card_transaction_items (0014) para o cartão de crédito.

CREATE TABLE IF NOT EXISTS card_transaction_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id  INTEGER NOT NULL REFERENCES card_transactions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  quantity        REAL NOT NULL DEFAULT 1,
  unit_price      REAL,
  amount          REAL NOT NULL,
  category        TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_card_transaction_items_tx_id
  ON card_transaction_items(transaction_id);
