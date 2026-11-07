// Gasto do mês por categoria, juntando três fontes:
// - contas normais (categoria da conta);
// - faturas de cartão abertas nas compras (categoria de cada compra; o que não foi detalhado fica em "cartão");
// - cartões alimentação do mês (subcategorias como mercado/refeição contam como alimentação).
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { normalizeCategory, type SpendingCategory } from "@/lib/categories";

export interface SpendingLine {
  source: "conta" | "cartão" | "alimentação";
  category: SpendingCategory;
  name: string;
  amount: number;
  date: string | null;
  /** Fatura ou cartão alimentação de origem. */
  origin: string | null;
  /** Fatura (conta CARD) de origem, para compras do cartão. */
  billId?: number;
}

export interface MonthSpending {
  lines: SpendingLine[];
  byCategory: Partial<Record<SpendingCategory, number>>;
  bills: number;
  meal: { spent: number; limit: number };
}

export async function getMonthSpending(userId: number, month: number, year: number): Promise<MonthSpending> {
  const [bills, mealCards] = await Promise.all([
    db.query.bills.findMany({
      where: and(eq(schema.bills.userId, userId), eq(schema.bills.month, month), eq(schema.bills.year, year)),
    }),
    db.query.mealCards.findMany({
      where: and(eq(schema.mealCards.userId, userId), eq(schema.mealCards.month, month), eq(schema.mealCards.year, year)),
    }),
  ]);

  const cardBills = bills.filter((b) => b.type === "CARD");
  const [cardTxs, mealTxs] = await Promise.all([
    cardBills.length
      ? db.query.cardTransactions.findMany({ where: inArray(schema.cardTransactions.billId, cardBills.map((b) => b.id)) })
      : Promise.resolve([]),
    mealCards.length
      ? db.query.mealCardTransactions.findMany({
          where: inArray(schema.mealCardTransactions.mealCardId, mealCards.map((c) => c.id)),
        })
      : Promise.resolve([]),
  ]);

  const lines: SpendingLine[] = [];
  for (const b of bills.filter((b) => b.type !== "CARD")) {
    lines.push({ source: "conta", category: normalizeCategory(b.category), name: b.name, amount: b.amount, date: b.date, origin: null });
  }
  for (const bill of cardBills) {
    const txs = cardTxs.filter((t) => t.billId === bill.id);
    for (const t of txs) {
      lines.push({
        source: "cartão",
        category: t.category ? normalizeCategory(t.category) : "cartão",
        name: t.name,
        amount: t.amount,
        date: t.date,
        origin: bill.cardNickname || bill.name,
        billId: bill.id,
      });
    }
    const rest = bill.amount - txs.reduce((s, t) => s + t.amount, 0);
    if (rest > 0.009) {
      lines.push({ source: "cartão", category: "cartão", name: `${bill.name} (não detalhado)`, amount: rest, date: null, origin: bill.cardNickname || bill.name, billId: bill.id });
    }
  }
  for (const t of mealTxs) {
    const card = mealCards.find((c) => c.id === t.mealCardId);
    lines.push({
      source: "alimentação",
      category: t.category && normalizeCategory(t.category) !== "outros" ? normalizeCategory(t.category) : "alimentação",
      name: t.name,
      amount: t.amount,
      date: t.date,
      origin: card?.name ?? null,
    });
  }

  const byCategory: Partial<Record<SpendingCategory, number>> = {};
  for (const l of lines) byCategory[l.category] = (byCategory[l.category] ?? 0) + l.amount;

  return {
    lines,
    byCategory,
    bills: bills.reduce((s, b) => s + b.amount, 0),
    meal: {
      spent: mealTxs.reduce((s, t) => s + t.amount, 0),
      limit: mealCards.reduce((s, c) => s + c.limitAmount, 0),
    },
  };
}
