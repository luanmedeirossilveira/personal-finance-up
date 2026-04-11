ALTER TABLE debt_bill_links
ADD COLUMN history_debt_id INTEGER REFERENCES history_debts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_debt_bill_links_history_debt
ON debt_bill_links(history_debt_id);
