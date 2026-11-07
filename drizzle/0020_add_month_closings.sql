-- v3: "Fechar conta" do mês — registra o fechamento (com resumo) depois de todas as contas pagas.
-- Mês fechado fica só leitura (contas e cartões alimentação) e o Mês passa a abrir no seguinte.
CREATE TABLE IF NOT EXISTS month_closings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month       INTEGER NOT NULL,
  year        INTEGER NOT NULL,
  -- JSON: { income, outflow, invested, bills, billCount, meal: { spent, limit }, byCategory }
  summary     TEXT NOT NULL DEFAULT '{}',
  closed_at   TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, month, year)
);
