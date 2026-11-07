// Revisão obrigatória (v3): gatilho semanal/mensal, válvula de adiamento e snapshot dos números.
//
// Convenção: uma revisão semanal feita em qualquer dia da semana ISO N fecha a semana N-1.
// `weekNumber`/`year` gravam a semana ISO *revisada* com o ano ISO (getISOWeekYear), para a
// virada de ano não quebrar a busca (a semana 1 de 2027 começa em 28/12/2026).
// O fechamento mensal grava em `month` o mês fechado e em `weekNumber`/`year` a semana revisada,
// então ele vale também como a revisão semanal daquela semana. Como `year` guarda o ano ISO,
// o fechamento de dezembro feito em janeiro pode ter `year` = ano seguinte; a busca aceita os dois.
//
// Sem migration: o adiamento usa uma linha `type = 'snooze'` na própria weekly_checkins.
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getDebtBalances, totalDebt, type DebtBalance } from "@/lib/debts";
import { getDefaultPeriod, todayISO } from "@/lib/month";
import { getCardsUsage } from "@/lib/cards";
import { categoryLabel } from "@/lib/categories";
import { getWorkingPeriod } from "@/lib/month-closing";
import { getMonthSpending, type SpendingLine } from "@/lib/month-spending";
import { saveNetWorthSnapshot } from "@/lib/networth";
import { SNOOZE_HOURS, reviewedMonth, reviewedWeek, type ReviewedWeek } from "@/lib/revisao-shared";

export { SNOOZE_HOURS, reviewedMonth, reviewedWeek };

export type GateMode = "weekly" | "monthly";

export interface RevisaoStatus {
  week: ReviewedWeek;
  month: { month: number; year: number };
  weeklyDone: boolean;
  monthlyDone: boolean;
  /** Qual revisão o gate exige agora (null = nenhuma). */
  due: GateMode | null;
  snoozedUntil: string | null;
  snoozeAvailable: boolean;
}

export async function getRevisaoStatus(userId: number, now = new Date()): Promise<RevisaoStatus> {
  const week = reviewedWeek(now);
  const month = reviewedMonth(now);

  const rows = await db.query.weeklyCheckins.findMany({
    where: and(
      eq(schema.weeklyCheckins.userId, userId),
      inArray(schema.weeklyCheckins.type, ["weekly", "monthly", "snooze"]),
      gte(schema.weeklyCheckins.year, Math.min(week.isoYear, month.year)),
    ),
    orderBy: [desc(schema.weeklyCheckins.createdAt)],
    limit: 30,
  });

  const inWeek = (r: (typeof rows)[number]) => r.weekNumber === week.weekNumber && r.year === week.isoYear;
  const weeklyDone = rows.some((r) => (r.type === "weekly" || r.type === "monthly") && inWeek(r));
  const monthlyDone = rows.some(
    (r) => r.type === "monthly" && r.month === month.month && (r.year === month.year || r.year === month.year + 1),
  );

  const snooze = rows.find((r) => r.type === "snooze" && inWeek(r));
  let snoozedUntil: string | null = null;
  if (snooze) {
    try {
      snoozedUntil = (JSON.parse(snooze.data) as { until?: string }).until ?? null;
    } catch {
      snoozedUntil = null;
    }
  }
  const snoozeActive = snoozedUntil !== null && new Date(snoozedUntil) > now;

  const pending: GateMode | null = !monthlyDone ? "monthly" : !weeklyDone ? "weekly" : null;
  return {
    week,
    month,
    weeklyDone,
    monthlyDone,
    due: snoozeActive ? null : pending,
    snoozedUntil,
    snoozeAvailable: !snooze,
  };
}

export async function snoozeRevisao(userId: number, now = new Date()) {
  const status = await getRevisaoStatus(userId, now);
  if (!status.snoozeAvailable) return null;
  const until = new Date(now.getTime() + SNOOZE_HOURS * 3_600_000).toISOString();
  await db.insert(schema.weeklyCheckins).values({
    userId,
    weekNumber: status.week.weekNumber,
    month: now.getMonth() + 1,
    year: status.week.isoYear,
    type: "snooze",
    data: JSON.stringify({ until }),
  });
  return until;
}

// ─── Contexto pré-preenchido para o formulário ───────────────────────────────

export interface RevisaoBill {
  id: number;
  name: string;
  amount: number;
  isPaid: boolean;
  dueDate: string | null;
}

export interface RevisaoFuture {
  id: number;
  name: string;
  amount: number | null;
  reminderDate: string | null;
}

export interface Scores {
  controle: number;
  preocupacaoDividas: number;
  confianca: number;
}

export interface Snapshot {
  saldo: number;
  gastoSemana: number;
  dividaTotal: number;
  patrimonio: number;
  porCategoria: Record<string, number>;
}

export interface CheckinData {
  snapshot?: Snapshot;
  scores?: Scores;
  decision?: string;
  previousDecisionKept?: boolean | null;
  highlight?: string;
  answers?: { question: string; answer: string }[];
  improvement?: string;
}

export interface CheckinRow {
  id: number;
  weekNumber: number;
  month: number;
  year: number;
  type: string;
  createdAt: string | null;
  data: CheckinData;
}

export interface RevisaoTransaction {
  id: number;
  date: string;
  amount: number;
  description: string;
  category: string | null;
  accountName: string | null;
}

export interface RevisaoContext {
  status: RevisaoStatus;
  period: { month: number; year: number };
  weekBills: RevisaoBill[];
  /** Saídas do Pluggy/importação sem categoria — confirmar em lote no passo Conferir. */
  uncategorized: RevisaoTransaction[];
  /** Contas dela cuja última importação de extrato passou de 7 dias. */
  staleImports: { id: number; name: string; lastImportAt: string | null }[];
  /** Categorias e cartões acima do limite no mês, com os lançamentos que pesaram. */
  overLimit: { key: string; label: string; spent: number; limit: number; lines: SpendingLine[] }[];
  /** Investimentos manuais: saldo atualizado no fechamento mensal (fallback do Pluggy). */
  manualInvestments: { id: number; name: string; balance: number }[];
  futures: RevisaoFuture[];
  debts: DebtBalance[];
  previousDecision: string | null;
  history: CheckinRow[];
}

const pad = (n: number) => String(n).padStart(2, "0");

export function parseCheckin(c: typeof schema.weeklyCheckins.$inferSelect): CheckinRow {
  let data: CheckinData = {};
  try {
    data = JSON.parse(c.data);
  } catch {
    data = {};
  }
  return {
    id: c.id,
    weekNumber: c.weekNumber,
    month: c.month,
    year: c.year,
    type: c.type,
    createdAt: c.createdAt,
    data,
  };
}

export async function getRevisaoContext(userId: number, now = new Date()): Promise<RevisaoContext> {
  const status = await getRevisaoStatus(userId, now);
  const period = await getWorkingPeriod(userId, now);
  const calMonth = now.getMonth() + 1;
  const calYear = now.getFullYear();

  const [periodBills, calBills, futures, debts, history, pendingTxs, accounts, investments] = await Promise.all([
    db.query.bills.findMany({
      where: and(eq(schema.bills.userId, userId), eq(schema.bills.month, period.month), eq(schema.bills.year, period.year)),
    }),
    db.query.bills.findMany({
      where: and(eq(schema.bills.userId, userId), eq(schema.bills.month, calMonth), eq(schema.bills.year, calYear)),
    }),
    db.query.futureBills.findMany({ where: eq(schema.futureBills.userId, userId) }),
    getDebtBalances(userId),
    db.query.weeklyCheckins.findMany({
      where: and(eq(schema.weeklyCheckins.userId, userId), inArray(schema.weeklyCheckins.type, ["weekly", "monthly"])),
      orderBy: [desc(schema.weeklyCheckins.createdAt)],
      limit: 52,
    }),
    db.query.bankTransactions.findMany({
      where: and(
        eq(schema.bankTransactions.userId, userId),
        eq(schema.bankTransactions.status, "pending"),
        lte(schema.bankTransactions.amount, 0),
      ),
      orderBy: [desc(schema.bankTransactions.date)],
      limit: 60,
    }),
    db.query.accounts.findMany({ where: and(eq(schema.accounts.userId, userId), eq(schema.accounts.archived, false)) }),
    db.query.investments.findMany({
      where: and(eq(schema.investments.userId, userId), eq(schema.investments.source, "manual")),
    }),
  ]);

  // Limites estourados: categorias (contas + cartão + alimentação) e cartões planejados.
  const [spending, budgets, cardsUsage] = await Promise.all([
    getMonthSpending(userId, period.month, period.year),
    db.query.categoryBudgets.findMany({
      where: and(
        eq(schema.categoryBudgets.userId, userId),
        eq(schema.categoryBudgets.month, period.month),
        eq(schema.categoryBudgets.year, period.year),
      ),
    }),
    getCardsUsage(userId, period.month, period.year),
  ]);
  const overLimit: RevisaoContext["overLimit"] = [];
  for (const b of budgets) {
    const spent = spending.byCategory[b.category as keyof typeof spending.byCategory] ?? 0;
    if (b.amount > 0 && spent > b.amount) {
      overLimit.push({
        key: `cat:${b.category}`,
        label: categoryLabel(b.category),
        spent,
        limit: b.amount,
        lines: spending.lines.filter((l) => l.category === b.category).sort((x, y) => y.amount - x.amount),
      });
    }
  }
  for (const c of cardsUsage) {
    if (c.ratio !== null && c.ratio > 1) {
      overLimit.push({
        key: `card:${c.id}`,
        label: `Cartão ${c.name}`,
        spent: c.used,
        limit: c.monthlyLimit,
        lines: spending.lines
          .filter((l) => l.billId !== undefined && c.bills.some((b) => b.id === l.billId))
          .sort((x, y) => y.amount - x.amount),
      });
    }
  }

  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const staleImports = accounts
    .filter((a) => a.ownership === "hers" && a.source === "manual" && a.type !== "meal")
    .filter((a) => !a.lastImportAt || a.lastImportAt < weekAgo)
    .map((a) => ({ id: a.id, name: a.name, lastImportAt: a.lastImportAt }));
  const uncategorized = pendingTxs.map((t) => ({
    id: t.id,
    date: t.date,
    amount: t.amount,
    description: t.description,
    category: t.category,
    accountName: accounts.find((a) => a.id === t.accountId)?.name ?? null,
  }));

  // Conferir: contas que venceram na semana revisada, até hoje, mais as em aberto já vencidas.
  const today = todayISO(now);
  const seen = new Set<number>();
  const weekBills: RevisaoBill[] = [...calBills, ...periodBills]
    .filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    })
    .map((b) => ({
      id: b.id,
      name: b.name,
      amount: b.amount,
      isPaid: Boolean(b.isPaid),
      dueDate: b.dueDay ? `${b.year}-${pad(b.month)}-${pad(b.dueDay)}` : null,
    }))
    .filter((b) => b.dueDate && b.dueDate <= today && (b.dueDate >= status.week.start || !b.isPaid))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const parsed = history.map(parseCheckin);
  const previousDecision = parsed.find((c) => c.data.decision)?.data.decision ?? null;

  return {
    status,
    period,
    weekBills,
    uncategorized,
    staleImports,
    overLimit,
    manualInvestments: investments.map((i) => ({ id: i.id, name: i.name, balance: i.balance })),
    futures: futures.map((f) => ({ id: f.id, name: f.name, amount: f.amount ?? null, reminderDate: f.reminderDate ?? null })),
    debts: debts.filter((d) => !d.isPaid),
    previousDecision,
    history: parsed,
  };
}

// Retrato dos números no momento da revisão — base da aba Evolução.
export async function computeSnapshot(userId: number, now = new Date()): Promise<Snapshot> {
  const period = getDefaultPeriod(now);
  const week = reviewedWeek(now);

  const [bills, salaries, debts, cardIds, mealIds] = await Promise.all([
    db.query.bills.findMany({
      where: and(eq(schema.bills.userId, userId), eq(schema.bills.month, period.month), eq(schema.bills.year, period.year)),
    }),
    db.query.salaries.findMany({
      where: and(eq(schema.salaries.userId, userId), eq(schema.salaries.month, period.month), eq(schema.salaries.year, period.year)),
    }),
    getDebtBalances(userId),
    db.select({ id: schema.bills.id }).from(schema.bills).where(eq(schema.bills.userId, userId)),
    db.select({ id: schema.mealCards.id }).from(schema.mealCards).where(eq(schema.mealCards.userId, userId)),
  ]);

  let gastoSemana = 0;
  if (cardIds.length > 0) {
    const rows = await db
      .select({ amount: schema.cardTransactions.amount })
      .from(schema.cardTransactions)
      .where(
        and(
          inArray(schema.cardTransactions.billId, cardIds.map((r) => r.id)),
          gte(schema.cardTransactions.date, week.start),
          lte(schema.cardTransactions.date, week.end),
        ),
      );
    gastoSemana += rows.reduce((s, r) => s + r.amount, 0);
  }
  if (mealIds.length > 0) {
    const rows = await db
      .select({ amount: schema.mealCardTransactions.amount })
      .from(schema.mealCardTransactions)
      .where(
        and(
          inArray(schema.mealCardTransactions.mealCardId, mealIds.map((r) => r.id)),
          gte(schema.mealCardTransactions.date, week.start),
          lte(schema.mealCardTransactions.date, week.end),
        ),
      );
    gastoSemana += rows.reduce((s, r) => s + r.amount, 0);
  }

  const porCategoria: Record<string, number> = {};
  for (const b of bills) {
    const key = b.category || "outros";
    porCategoria[key] = (porCategoria[key] ?? 0) + b.amount;
  }

  const income = salaries.reduce((s, x) => s + x.amount, 0);
  const total = bills.reduce((s, b) => s + b.amount, 0);
  const dividaTotal = totalDebt(debts);
  // A Revisão também grava o retrato do patrimônio do dia (contas + investimentos − dívidas).
  const netWorth = await saveNetWorthSnapshot(userId, now);

  return {
    saldo: income - total,
    gastoSemana,
    dividaTotal,
    patrimonio: netWorth.netWorth,
    porCategoria,
  };
}
