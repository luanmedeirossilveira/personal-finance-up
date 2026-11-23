// Persistência do assistente: dono do número e log de mensagens (wa_messages).
import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// App de um usuário só (ADMIN_EMAIL), como os crons: o número do WhatsApp é o desse usuário.
export async function getOwnerUser() {
  const email = process.env.ADMIN_EMAIL;
  const byEmail = email ? await db.query.users.findFirst({ where: eq(schema.users.email, email) }) : undefined;
  return byEmail ?? (await db.query.users.findFirst());
}

export async function findSavedReply(messageId: string) {
  const row = await db.query.waMessages.findFirst({ where: eq(schema.waMessages.messageId, messageId) });
  return row ? { reply: row.reply ?? "" } : null;
}

export async function saveMessage(values: {
  userId: number;
  messageId: string | null;
  direction: "in" | "out";
  text: string;
  intent: string | null;
  reply: string | null;
}) {
  await db.insert(schema.waMessages).values(values).onConflictDoNothing();
}

// Já houve mensagem proativa com esse intent desde `sinceUtc` ("YYYY-MM-DD HH:MM:SS", UTC como o datetime('now'))?
export async function sentSince(userId: number, intent: string, sinceUtc: string) {
  const row = await db.query.waMessages.findFirst({
    where: and(
      eq(schema.waMessages.userId, userId),
      eq(schema.waMessages.direction, "out"),
      eq(schema.waMessages.intent, intent),
      gte(schema.waMessages.createdAt, sinceUtc),
    ),
  });
  return Boolean(row);
}
