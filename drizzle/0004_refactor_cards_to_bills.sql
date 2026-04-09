-- Migration: Refatorar cartões para bills com transações
-- Consolida cards e cardInvoices em bills do tipo CARD com transações filhas

-- 1. Adicionar novos campos na tabela bills
ALTER TABLE bills ADD COLUMN type TEXT DEFAULT 'NORMAL';
ALTER TABLE bills ADD COLUMN card_last4 TEXT;
ALTER TABLE bills ADD COLUMN card_nickname TEXT;

-- 2. Criar tabela de transações de cartão
CREATE TABLE IF NOT EXISTS card_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  installment TEXT,
  category TEXT,
  date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_card_transactions_bill_id ON card_transactions(bill_id);

-- 3. Migrar dados: criar bills tipo CARD a partir de cardInvoices existentes
-- Para cada cardInvoice, cria uma bill tipo CARD
INSERT INTO bills (user_id, name, amount, month, year, is_paid, due_day, category, type, card_last4, card_nickname, created_at)
SELECT 
  ci.user_id,
  COALESCE(c.name, 'Cartão') || ' - ' || ci.month || '/' || ci.year,
  ci.amount_total,
  ci.month,
  ci.year,
  ci.is_paid,
  CAST(substr(ci.due_date, 9, 2) AS INTEGER), -- extrai dia do due_date YYYY-MM-DD
  'cartão',
  'CARD',
  c.last4,
  c.name,
  ci.created_at
FROM card_invoices ci
LEFT JOIN cards c ON ci.card_id = c.id;

-- 4. Migrar bills existentes que estavam vinculadas a cardInvoices como transações
-- Primeiro, precisamos mapear os IDs das novas bills criadas
-- Como SQLite não tem variáveis, fazemos via subquery

-- Criar transações a partir de bills que tinham cardInvoiceId
INSERT INTO card_transactions (bill_id, name, amount, installment, category, date, created_at)
SELECT 
  new_bill.id,
  old_bill.name,
  old_bill.amount,
  old_bill.installment,
  old_bill.category,
  old_bill.year || '-' || printf('%02d', old_bill.month) || '-' || printf('%02d', COALESCE(old_bill.due_day, 1)),
  old_bill.created_at
FROM bills old_bill
INNER JOIN card_invoices ci ON old_bill.card_invoice_id = ci.id
INNER JOIN (
  SELECT 
    b.id,
    b.month,
    b.year,
    b.card_nickname,
    b.user_id
  FROM bills b
  WHERE b.type = 'CARD'
) new_bill ON new_bill.month = ci.month 
          AND new_bill.year = ci.year 
          AND new_bill.user_id = ci.user_id
          AND new_bill.card_nickname = (SELECT name FROM cards WHERE id = ci.card_id)
WHERE old_bill.card_invoice_id IS NOT NULL;

-- 5. Remover bills que foram convertidas em transações
DELETE FROM bills WHERE card_invoice_id IS NOT NULL;

-- 6. Remover coluna card_invoice_id (SQLite não suporta DROP COLUMN diretamente em versões antigas)
-- Criamos nova tabela sem a coluna e copiamos os dados

-- Criar tabela temporária com nova estrutura
CREATE TABLE bills_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  installment TEXT,
  is_paid INTEGER DEFAULT 0,
  due_day INTEGER,
  category TEXT,
  notes TEXT,
  bar_code TEXT,
  qr_code TEXT,
  attachments TEXT,
  type TEXT DEFAULT 'NORMAL',
  card_last4 TEXT,
  card_nickname TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Copiar dados
INSERT INTO bills_new (id, user_id, name, amount, month, year, installment, is_paid, due_day, category, notes, bar_code, qr_code, attachments, type, card_last4, card_nickname, created_at, updated_at)
SELECT id, user_id, name, amount, month, year, installment, is_paid, due_day, category, notes, bar_code, qr_code, attachments, type, card_last4, card_nickname, created_at, updated_at
FROM bills;

-- Remover tabela antiga e renomear nova
DROP TABLE bills;
ALTER TABLE bills_new RENAME TO bills;

-- Recriar índices
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_month_year ON bills(month, year);
CREATE INDEX IF NOT EXISTS idx_bills_type ON bills(type);

-- 7. Drop tabelas antigas de cards
DROP TABLE IF EXISTS card_invoices;
DROP TABLE IF EXISTS cards;
