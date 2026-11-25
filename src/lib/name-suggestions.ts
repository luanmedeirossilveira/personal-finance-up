// Histórico de descrições por tipo de compra, para o autocomplete dos formulários.
// Conta = contas normais (faturas de cartão ficam de fora: o nome delas não se repete como compra).
import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { buildNameSuggestions, type NameHistoryRow, type NameSuggestion, type SuggestionSource } from "@/lib/name-suggestions-shared";

// Os últimos lançamentos bastam: o que não aparece há muito tempo não é compra repetitiva.
const HISTORY_LIMIT = 1000;
// Teto da resposta; o filtro pelo que é digitado roda no cliente.
const MAX_SUGGESTIONS = 300;

async function loadHistory(userId: number, source: SuggestionSource) {
  if (source === "bill") {
    const b = schema.bills;
    return db
      .select({ name: b.name, category: b.category, amount: b.amount, date: b.date, createdAt: b.createdAt })
      .from(b)
      .where(and(eq(b.userId, userId), or(isNull(b.type), ne(b.type, "CARD"))))
      .orderBy(desc(b.id))
      .limit(HISTORY_LIMIT);
  }
  if (source === "card") {
    const t = schema.cardTransactions;
    return db
      .select({ name: t.name, category: t.category, amount: t.amount, date: t.date, createdAt: t.createdAt })
      .from(t)
      .innerJoin(schema.bills, eq(t.billId, schema.bills.id))
      .where(eq(schema.bills.userId, userId))
      .orderBy(desc(t.id))
      .limit(HISTORY_LIMIT);
  }
  const t = schema.mealCardTransactions;
  return db
    .select({ name: t.name, category: t.category, amount: t.amount, date: t.date, createdAt: t.createdAt })
    .from(t)
    .innerJoin(schema.mealCards, eq(t.mealCardId, schema.mealCards.id))
    .where(eq(schema.mealCards.userId, userId))
    .orderBy(desc(t.id))
    .limit(HISTORY_LIMIT);
}

export async function getNameSuggestions(userId: number, source: SuggestionSource): Promise<NameSuggestion[]> {
  const rows: NameHistoryRow[] = (await loadHistory(userId, source)).map((r) => ({
    name: r.name,
    category: r.category,
    amount: r.amount,
    usedAt: r.date ?? r.createdAt ?? null,
  }));
  return buildNameSuggestions(rows).slice(0, MAX_SUGGESTIONS);
}
