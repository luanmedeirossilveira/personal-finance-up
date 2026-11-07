// "Fechar conta" do mês: com todas as contas pagas, grava o resumo do mês, deixa o mês e os
// cartões alimentação só leitura e prepara os cartões alimentação do mês seguinte (mesmo limite).
// O Mês passa a abrir no mês seguinte ao último fechado.
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getDefaultPeriod, getNextMonthYear } from "@/lib/month";
import { getMonthSpending } from "@/lib/month-spending";

export interface ClosingSummary {
  income: number;
  outflow: number;
  invested: number;
  bills: number;
  billCount: number;
  meal: { spent: number; limit: number };
  byCategory: Record<string, number>;
}

export interface Closing {
  month: number;
  year: number;
  closedAt: string | null;
  summary: ClosingSummary;
}

function toClosing(r: typeof schema.monthClosings.$inferSelect): Closing {
  let summary = {} as ClosingSummary;
  try {
    summary = JSON.parse(r.summary);
  } catch {
    // resumo corrompido não impede ler o fechamento
  }
  return { month: r.month, year: r.year, closedAt: r.closedAt, summary };
}

export async function getClosing(userId: number, month: number, year: number): Promise<Closing | null> {
  const row = await db.query.monthClosings.findFirst({
    where: and(eq(schema.monthClosings.userId, userId), eq(schema.monthClosings.month, month), eq(schema.monthClosings.year, year)),
  });
  return row ? toClosing(row) : null;
}

export async function isMonthClosed(userId: number, month: number, year: number) {
  try {
    return (await getClosing(userId, month, year)) !== null;
  } catch {
    return false; // tabela ainda não migrada: nada fechado
  }
}

// Período de trabalho: o mês seguinte ao último fechado, nunca antes do padrão de hoje.
export async function getWorkingPeriod(userId: number, now = new Date()) {
  const fallback = getDefaultPeriod(now);
  try {
    const last = await db.query.monthClosings.findFirst({
      where: eq(schema.monthClosings.userId, userId),
      orderBy: [desc(schema.monthClosings.year), desc(schema.monthClosings.month)],
    });
    if (!last) return fallback;
    const next = getNextMonthYear(last.month, last.year);
    const candidate = { month: next.nextMonth, year: next.nextYear };
    return candidate.year * 12 + candidate.month > fallback.year * 12 + fallback.month ? candidate : fallback;
  } catch {
    return fallback;
  }
}

export class ClosingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function closeMonth(userId: number, month: number, year: number): Promise<Closing> {
  const [bills, salaries, existing] = await Promise.all([
    db.query.bills.findMany({
      where: and(eq(schema.bills.userId, userId), eq(schema.bills.month, month), eq(schema.bills.year, year)),
    }),
    db.query.salaries.findMany({
      where: and(eq(schema.salaries.userId, userId), eq(schema.salaries.month, month), eq(schema.salaries.year, year)),
    }),
    getClosing(userId, month, year),
  ]);
  if (existing) throw new ClosingError("Este mês já está fechado.", 409);
  const pending = bills.filter((b) => !b.isPaid);
  if (pending.length > 0) {
    throw new ClosingError(`Ainda há ${pending.length} conta(s) em aberto: ${pending.map((b) => b.name).slice(0, 3).join(", ")}.`);
  }

  const spending = await getMonthSpending(userId, month, year);
  const invested = bills.filter((b) => b.category === "investimentos").reduce((s, b) => s + b.amount, 0);
  const total = bills.reduce((s, b) => s + b.amount, 0);
  const summary: ClosingSummary = {
    income: salaries.reduce((s, x) => s + x.amount, 0),
    outflow: total - invested,
    invested,
    bills: total,
    billCount: bills.length,
    meal: spending.meal,
    byCategory: spending.byCategory as Record<string, number>,
  };

  const [row] = await db
    .insert(schema.monthClosings)
    .values({ userId, month, year, summary: JSON.stringify(summary) })
    .returning();

  // Cartões alimentação: o mês seguinte começa com os mesmos cartões e limites, extrato zerado.
  const { nextMonth, nextYear } = getNextMonthYear(month, year);
  const [current, next] = await Promise.all([
    db.query.mealCards.findMany({
      where: and(eq(schema.mealCards.userId, userId), eq(schema.mealCards.month, month), eq(schema.mealCards.year, year)),
    }),
    db.query.mealCards.findMany({
      where: and(eq(schema.mealCards.userId, userId), eq(schema.mealCards.month, nextMonth), eq(schema.mealCards.year, nextYear)),
    }),
  ]);
  const existingNames = new Set(next.map((c) => c.name.trim().toLowerCase()));
  const toCreate = current.filter((c) => !existingNames.has(c.name.trim().toLowerCase()));
  if (toCreate.length > 0) {
    await db.insert(schema.mealCards).values(
      toCreate.map((c) => ({ userId, name: c.name, limitAmount: c.limitAmount, color: c.color, month: nextMonth, year: nextYear })),
    );
  }

  return toClosing(row);
}

export async function reopenMonth(userId: number, month: number, year: number) {
  await db
    .delete(schema.monthClosings)
    .where(and(eq(schema.monthClosings.userId, userId), eq(schema.monthClosings.month, month), eq(schema.monthClosings.year, year)));
}

// Resposta padrão das rotas de escrita quando o mês já foi fechado.
export const CLOSED_MONTH_ERROR = { error: "Este mês está fechado. Reabra o mês para editar." };
