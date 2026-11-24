-- Conferência da fatura com o app do banco: ordem manual das transações (nula = ordem
-- padrão por data) e marcação de "conferida" para ir ticando o extrato.
ALTER TABLE card_transactions ADD COLUMN position INTEGER;
ALTER TABLE card_transactions ADD COLUMN checked INTEGER NOT NULL DEFAULT 0;
