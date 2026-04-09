-- Migration: adicionar coluna card_invoice_id em bills
ALTER TABLE bills ADD COLUMN card_invoice_id INTEGER REFERENCES card_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bills_card_invoice_id ON bills(card_invoice_id);
