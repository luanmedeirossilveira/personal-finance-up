-- Assistente via WhatsApp (gateway próprio → POST /api/whatsapp/inbound).
-- `source` marca os lançamentos criados pelo assistente, para revisar no site (Revisão semanal).
ALTER TABLE bills ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

-- Log das mensagens: `message_id` único dá idempotência quando o gateway reenvia a mesma
-- mensagem; mensagens proativas (avisos do cron) ficam com `message_id` nulo e `direction` 'out'.
CREATE TABLE IF NOT EXISTS wa_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id  TEXT UNIQUE,
  direction   TEXT NOT NULL,
  text        TEXT NOT NULL,
  intent      TEXT,
  reply       TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS wa_messages_user_created_idx ON wa_messages(user_id, created_at);

-- Escrita pelo WhatsApp sempre passa por confirmação: a ação fica aqui por 10 min.
-- Uma pendência por usuário (a nova substitui a anterior).
CREATE TABLE IF NOT EXISTS wa_pending_actions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  -- JSON: { valor, descricao, categoria, data, categoryOptions? }
  payload     TEXT NOT NULL DEFAULT '{}',
  expires_at  TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id)
);
