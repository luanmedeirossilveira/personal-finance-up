-- Transações recorrentes (assinaturas) do cartão: repetidas na fatura do próximo mês
-- ao migrar. Não têm parcela — `installment` fica nulo.
ALTER TABLE card_transactions ADD COLUMN recurring INTEGER NOT NULL DEFAULT 0;
