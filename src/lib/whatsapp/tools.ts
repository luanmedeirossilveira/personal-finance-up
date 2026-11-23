// Uma função por intent, sempre sobre as mesmas regras do site (período de trabalho, gasto por
// categoria, saldo previsto, contas a vencer e criação de conta), para os números baterem.
// `now` é o instante real (expiração da pendência); `local` é a hora de parede em São Paulo.
import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createBill } from "@/lib/bills";
import { BILL_FORM_CATEGORIES, SPENDING_CATEGORIES, categoryLabel, type SpendingCategory } from "@/lib/categories";
import { MONTHS, summarizeMonth, todayISO } from "@/lib/month";
import { getWorkingPeriod, isMonthClosed } from "@/lib/month-closing";
import { getMonthSpending } from "@/lib/month-spending";
import { listUpcoming } from "@/lib/upcoming";
import { guessCategoryFromText, resolveCategory } from "./categories";
import type { Intent } from "./intents";
import { isPendingExpired, parseExpensePayload, pendingExpiresAt, type ExpensePayload } from "./pending";
import {
  CANCELLED_REPLY,
  EXPIRED_REPLY,
  HELP_REPLY,
  NOT_UNDERSTOOD_REPLY,
  NOTHING_PENDING_REPLY,
  categoryOptionsReply,
  categorySpendingReply,
  confirmExpenseReply,
  monthSummaryReply,
  recentReply,
  registeredReply,
  topCategoriesReply,
  upcomingReply,
  type RecentEntry,
} from "./templates";

type Period = { month: number; year: number };

const periodLabel = (p: Period) => `${MONTHS[p.month - 1]}/${p.year}`;
const closedReply = (p: Period) => `O mês ${periodLabel(p)} está fechado. Reabra no site para lançar.`;

// "YYYY-MM" ou, sem mês, o período de trabalho (o mesmo que o Hoje e o Mês abrem).
async function resolvePeriod(userId: number, mes: string | undefined, local: Date): Promise<Period> {
  if (mes) {
    const [year, month] = mes.split("-").map(Number);
    return { month, year };
  }
  return getWorkingPeriod(userId, local);
}

async function monthSummary(userId: number, p: Period) {
  const [bills, salaries] = await Promise.all([
    db.query.bills.findMany({
      where: and(eq(schema.bills.userId, userId), eq(schema.bills.month, p.month), eq(schema.bills.year, p.year)),
    }),
    db.query.salaries.findMany({
      where: and(eq(schema.salaries.userId, userId), eq(schema.salaries.month, p.month), eq(schema.salaries.year, p.year)),
    }),
  ]);
  return summarizeMonth(bills, salaries);
}

export async function resumoMes(userId: number, mes: string | undefined, local: Date) {
  const p = await resolvePeriod(userId, mes, local);
  const [summary, closed] = await Promise.all([monthSummary(userId, p), isMonthClosed(userId, p.month, p.year)]);
  return monthSummaryReply(periodLabel(p), summary, closed);
}

export async function gastosPorCategoria(userId: number, categoria: string | undefined, mes: string | undefined, local: Date) {
  const p = await resolvePeriod(userId, mes, local);
  const [spending, budgets] = await Promise.all([
    getMonthSpending(userId, p.month, p.year),
    db.query.categoryBudgets.findMany({
      where: and(
        eq(schema.categoryBudgets.userId, userId),
        eq(schema.categoryBudgets.month, p.month),
        eq(schema.categoryBudgets.year, p.year),
      ),
    }),
  ]);
  const limits: Record<string, number> = {};
  for (const b of budgets) limits[b.category] = (limits[b.category] ?? 0) + b.amount;
  const byCategory = spending.byCategory as Record<string, number>;

  if (!categoria) return topCategoriesReply(periodLabel(p), byCategory, limits);
  const match = resolveCategory(categoria, SPENDING_CATEGORIES);
  if (match.kind === "ambiguous") {
    return `Achei mais de uma categoria: ${match.options.map((c) => `*${categoryLabel(c)}*`).join(", ")}. Manda de novo com o nome certinho.`;
  }
  if (match.kind === "none") {
    return `Não conheço a categoria "${categoria}". Tenho: ${BILL_FORM_CATEGORIES.map(categoryLabel).join(", ")}.`;
  }
  return categorySpendingReply(periodLabel(p), match.category, byCategory[match.category] ?? 0, limits[match.category]);
}

// Contas com vencimento entre o mês corrente e o mês de hoje + `days` (a data de vencimento é
// mês/ano da conta + dia de vencimento, como no Hoje), mais as futuras com lembrete.
export async function upcomingFor(userId: number, local: Date, days: number, withFuture = true) {
  const end = new Date(local.getFullYear(), local.getMonth(), local.getDate() + days);
  const from = local.getFullYear() * 12 + local.getMonth() + 1;
  const to = end.getFullYear() * 12 + end.getMonth() + 1;
  const [bills, futureBills] = await Promise.all([
    db.query.bills.findMany({
      where: and(
        eq(schema.bills.userId, userId),
        sql`(${schema.bills.year} * 12 + ${schema.bills.month}) between ${from} and ${to}`,
      ),
    }),
    withFuture ? db.query.futureBills.findMany({ where: eq(schema.futureBills.userId, userId) }) : Promise.resolve([]),
  ]);
  return listUpcoming(bills, futureBills, local, days);
}

export async function contasAVencer(userId: number, dias: number, local: Date) {
  return upcomingReply(await upcomingFor(userId, local, dias), dias, local);
}

// Lançamentos manuais mais recentes: contas (menos faturas), compras do cartão e dos cartões alimentação.
export async function ultimosLancamentos(userId: number, quantidade: number, local: Date) {
  const ct = schema.cardTransactions;
  const mt = schema.mealCardTransactions;
  const [bills, cardTxs, mealTxs] = await Promise.all([
    db.query.bills.findMany({
      where: and(eq(schema.bills.userId, userId), or(isNull(schema.bills.type), ne(schema.bills.type, "CARD"))),
      orderBy: [desc(schema.bills.createdAt), desc(schema.bills.id)],
      limit: quantidade,
    }),
    db
      .select({ name: ct.name, amount: ct.amount, date: ct.date, category: ct.category, createdAt: ct.createdAt, origin: schema.bills.cardNickname, billName: schema.bills.name })
      .from(ct)
      .innerJoin(schema.bills, eq(ct.billId, schema.bills.id))
      .where(eq(schema.bills.userId, userId))
      .orderBy(desc(ct.createdAt), desc(ct.id))
      .limit(quantidade),
    db
      .select({ name: mt.name, amount: mt.amount, date: mt.date, category: mt.category, createdAt: mt.createdAt, origin: schema.mealCards.name })
      .from(mt)
      .innerJoin(schema.mealCards, eq(mt.mealCardId, schema.mealCards.id))
      .where(eq(schema.mealCards.userId, userId))
      .orderBy(desc(mt.createdAt), desc(mt.id))
      .limit(quantidade),
  ]);

  const created = (c: string | null) => c ?? "";
  const entries: (RecentEntry & { createdAt: string })[] = [
    ...bills.map((b) => ({ name: b.name, amount: b.amount, date: b.date ?? created(b.createdAt).slice(0, 10), category: b.category, origin: null, createdAt: created(b.createdAt) })),
    ...cardTxs.map((t) => ({ name: t.name, amount: t.amount, date: t.date ?? created(t.createdAt).slice(0, 10), category: t.category ?? "cartão", origin: t.origin || t.billName, createdAt: created(t.createdAt) })),
    ...mealTxs.map((t) => ({ name: t.name, amount: t.amount, date: t.date ?? created(t.createdAt).slice(0, 10), category: t.category ?? "alimentação", origin: t.origin, createdAt: created(t.createdAt) })),
  ];
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return recentReply(entries.slice(0, quantidade), local);
}

// ── Escrita: sempre via pendência + confirmação ─────────────────────────────

async function getPending(userId: number) {
  return db.query.waPendingActions.findFirst({ where: eq(schema.waPendingActions.userId, userId) });
}

async function savePending(userId: number, payload: ExpensePayload, now: Date) {
  // Uma pendência por vez: a nova substitui a anterior.
  await db.delete(schema.waPendingActions).where(eq(schema.waPendingActions.userId, userId));
  await db.insert(schema.waPendingActions).values({
    userId,
    type: "registrar_gasto",
    payload: JSON.stringify(payload),
    expiresAt: pendingExpiresAt(now),
  });
}

export async function registrarGasto(
  userId: number,
  args: Extract<Intent, { name: "registrarGasto" }>["args"],
  now: Date,
  local: Date,
) {
  const period = await getWorkingPeriod(userId, local);
  if (await isMonthClosed(userId, period.month, period.year)) return closedReply(period);

  let categoria: SpendingCategory | null = null;
  let categoryOptions: SpendingCategory[] | undefined;
  const match = args.categoria ? resolveCategory(args.categoria, BILL_FORM_CATEGORIES) : { kind: "none" as const };
  if (match.kind === "match") categoria = match.category;
  else if (match.kind === "ambiguous") categoryOptions = match.options;
  else categoria = guessCategoryFromText(args.descricao, BILL_FORM_CATEGORIES) ?? "outros";

  const payload: ExpensePayload = {
    valor: args.valor,
    descricao: args.descricao,
    categoria,
    data: args.data ?? todayISO(local),
    ...(categoryOptions ? { categoryOptions } : {}),
  };
  await savePending(userId, payload, now);
  return categoryOptions ? categoryOptionsReply(categoryOptions) : confirmExpenseReply({ ...payload, categoria: categoria as string }, local);
}

export async function escolherOpcao(userId: number, opcao: number, now: Date, local: Date) {
  const pending = await getPending(userId);
  const payload = pending && parseExpensePayload(pending.payload);
  if (!pending || !payload?.categoryOptions) return NOTHING_PENDING_REPLY;
  if (isPendingExpired(pending.expiresAt, now)) {
    await db.delete(schema.waPendingActions).where(eq(schema.waPendingActions.id, pending.id));
    return EXPIRED_REPLY;
  }
  const categoria = payload.categoryOptions[opcao - 1];
  if (!categoria) return categoryOptionsReply(payload.categoryOptions);

  const next: ExpensePayload = { valor: payload.valor, descricao: payload.descricao, categoria, data: payload.data };
  await db
    .update(schema.waPendingActions)
    .set({ payload: JSON.stringify(next), expiresAt: pendingExpiresAt(now) })
    .where(eq(schema.waPendingActions.id, pending.id));
  return confirmExpenseReply({ ...next, categoria }, local);
}

export async function confirmarAcao(userId: number, confirmar: boolean, now: Date, local: Date) {
  const pending = await getPending(userId);
  if (!pending) return NOTHING_PENDING_REPLY;
  const payload = parseExpensePayload(pending.payload);
  if (payload?.categoryOptions && confirmar) return categoryOptionsReply(payload.categoryOptions);

  // Apaga antes de gravar: dois "sim" seguidos não duplicam o lançamento.
  const [taken] = await db.delete(schema.waPendingActions).where(eq(schema.waPendingActions.id, pending.id)).returning();
  if (!taken) return NOTHING_PENDING_REPLY;
  if (isPendingExpired(pending.expiresAt, now)) return EXPIRED_REPLY;
  if (!confirmar) return CANCELLED_REPLY;
  if (!payload?.categoria) return EXPIRED_REPLY;

  const period = await getWorkingPeriod(userId, local);
  if (await isMonthClosed(userId, period.month, period.year)) return closedReply(period);

  await createBill(
    userId,
    {
      name: payload.descricao.charAt(0).toUpperCase() + payload.descricao.slice(1),
      amount: payload.valor,
      month: period.month,
      year: period.year,
      isPaid: true, // gasto já feito
      category: payload.categoria,
      // O número do WhatsApp é o do dono da conta; o que é dela ou do casal se ajusta no site.
      ownership: "mine",
      date: payload.data,
    },
    "whatsapp",
  );
  const summary = await monthSummary(userId, period);
  return registeredReply(summary.balance);
}

export async function runIntent(userId: number, intent: Intent, now: Date, local: Date): Promise<string> {
  switch (intent.name) {
    case "resumoMes":
      return resumoMes(userId, intent.args.mes, local);
    case "gastosPorCategoria":
      return gastosPorCategoria(userId, intent.args.categoria, intent.args.mes, local);
    case "contasAVencer":
      return contasAVencer(userId, intent.args.dias, local);
    case "ultimosLancamentos":
      return ultimosLancamentos(userId, intent.args.quantidade, local);
    case "registrarGasto":
      return registrarGasto(userId, intent.args, now, local);
    case "confirmarAcao":
      return confirmarAcao(userId, intent.args.confirmar, now, local);
    case "escolherOpcao":
      return escolherOpcao(userId, intent.args.opcao, now, local);
    case "ajuda":
      return HELP_REPLY;
    case "naoEntendi":
      return NOT_UNDERSTOOD_REPLY;
  }
}
