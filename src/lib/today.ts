// Dados da tela Hoje — "preciso fazer algo agora?". Calculado no servidor.
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCardsUsage, type CardUsage } from "@/lib/cards";
import { getDebtBalances, totalDebt } from "@/lib/debts";
import { latestInsights, type StoredInsight } from "@/lib/insights";
import { detectRisks } from "@/lib/risk";
import { BRL, MONTHS, getNextMonthYear } from "@/lib/month";
import { getWorkingPeriod } from "@/lib/month-closing";
import { getMonthSpending } from "@/lib/month-spending";

export interface UpcomingItem {
  kind: "bill" | "future";
  id: number;
  name: string;
  amount: number | null;
  dueDate: string; // YYYY-MM-DD
  overdue: boolean;
}

export interface Ring {
  key: "budget" | "paid" | "invest";
  label: string;
  value: number; // 0..n
  caption: string;
}

export interface Insight {
  id?: number;
  tone: "positive" | "warning" | "negative";
  title: string;
  message: string;
  action?: string | null;
  vote?: number | null;
}

export interface AccountBalance {
  id: number;
  name: string;
  type: string;
  balance: number;
  ownership: string;
  lastSyncAt: string | null;
}

export interface MatchSuggestion {
  txId: number;
  billId: number;
  billName: string;
  amount: number;
  date: string;
  description: string;
}

export interface TodayData {
  period: { month: number; year: number; label: string };
  summary: string;
  pendingTotal: number;
  pendingCount: number;
  projected: number;
  income: number;
  totalBills: number;
  debtTotal: number;
  upcoming: UpcomingItem[];
  rings: Ring[];
  insight: Insight | null;
  accounts: AccountBalance[];
  /** Cartões (seus e dela): uso no mês contra o planejado e fatura em aberto. */
  cards: CardUsage[];
  suggestions: MatchSuggestion[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function billsOf(userId: number, month: number, year: number) {
  return db.query.bills.findMany({
    where: and(eq(schema.bills.userId, userId), eq(schema.bills.month, month), eq(schema.bills.year, year)),
  });
}

export async function getTodayData(userId: number, now = new Date()): Promise<TodayData> {
  // Mesmo período da tela Mês: o seguinte ao último fechado (ou o padrão de hoje).
  const period = await getWorkingPeriod(userId, now);
  const prev = period.month === 1 ? { month: 12, year: period.year - 1 } : { month: period.month - 1, year: period.year };
  const after = getNextMonthYear(period.month, period.year);

  const [periodBills, prevBills, afterBills, salaries, budgets, futureBills, debts, alerts, accounts, suggestedTxs, stored] =
    await Promise.all([
    billsOf(userId, period.month, period.year),
    billsOf(userId, prev.month, prev.year),
    billsOf(userId, after.nextMonth, after.nextYear),
    db.query.salaries.findMany({
      where: and(
        eq(schema.salaries.userId, userId),
        eq(schema.salaries.month, period.month),
        eq(schema.salaries.year, period.year),
      ),
    }),
    db.query.categoryBudgets.findMany({
      where: and(
        eq(schema.categoryBudgets.userId, userId),
        eq(schema.categoryBudgets.month, period.month),
        eq(schema.categoryBudgets.year, period.year),
      ),
    }),
    db.query.futureBills.findMany({ where: eq(schema.futureBills.userId, userId) }),
    getDebtBalances(userId),
    db.query.riskAlerts.findMany({
      where: and(
        eq(schema.riskAlerts.userId, userId),
        eq(schema.riskAlerts.month, period.month),
        eq(schema.riskAlerts.year, period.year),
        isNull(schema.riskAlerts.dismissedAt),
      ),
    }),
    db.query.accounts.findMany({
      where: and(eq(schema.accounts.userId, userId), eq(schema.accounts.archived, false)),
      orderBy: [schema.accounts.createdAt],
    }),
    db.query.bankTransactions.findMany({
      where: and(eq(schema.bankTransactions.userId, userId), eq(schema.bankTransactions.status, "suggested")),
      limit: 10,
    }),
    latestInsights(userId, 1),
    ]);
  // Mesma soma da aba Categorias: contas + compras do cartão por categoria + cartões alimentação.
  const [spending, cards] = await Promise.all([
    getMonthSpending(userId, period.month, period.year),
    getCardsUsage(userId, period.month, period.year),
  ]);

  const income = salaries.reduce((s, x) => s + x.amount, 0);
  const totalBills = periodBills.reduce((s, b) => s + b.amount, 0);
  const pending = periodBills.filter((b) => !b.isPaid);
  const pendingTotal = pending.reduce((s, b) => s + b.amount, 0);
  const projected = income - totalBills;
  const debtTotal = totalDebt(debts);

  // ── Próximos 7 dias (com vencidas do mês corrente no topo) ────────────────
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = isoDate(weekEnd.getFullYear(), weekEnd.getMonth() + 1, weekEnd.getDate());

  const seen = new Set<number>();
  const candidates = [...prevBills, ...periodBills, ...afterBills].filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return !b.isPaid && !!b.dueDay;
  });
  const calMonth = today.getMonth() + 1;
  const calYear = today.getFullYear();
  const upcoming: UpcomingItem[] = candidates
    .map((b) => {
      const dueDate = isoDate(b.year, b.month, b.dueDay as number);
      const overdue = dueDate < todayStr && b.month === calMonth && b.year === calYear;
      return { kind: "bill" as const, id: b.id, name: b.name, amount: b.amount, dueDate, overdue };
    })
    .filter((u) => u.overdue || (u.dueDate >= todayStr && u.dueDate <= weekEndStr));

  for (const f of futureBills) {
    if (!f.reminderDate) continue;
    const d = f.reminderDate.slice(0, 10);
    if (d >= todayStr && d <= weekEndStr) {
      upcoming.push({ kind: "future", id: f.id, name: f.name, amount: f.amount ?? null, dueDate: d, overdue: false });
    }
  }
  upcoming.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueDate.localeCompare(b.dueDate));

  // ── Anéis: só onde há limite real ─────────────────────────────────────────
  const rings: Ring[] = [];
  const budgetTotal = budgets.reduce((s, b) => s + b.amount, 0);
  if (budgetTotal > 0) {
    const spent = budgets.reduce((s, b) => s + (spending.byCategory[b.category as keyof typeof spending.byCategory] ?? 0), 0);
    const left = budgetTotal - spent;
    rings.push({
      key: "budget",
      label: "Orçamento",
      value: spent / budgetTotal,
      caption: left >= 0 ? `sobram ${BRL(left)} nos limites` : `${BRL(-left)} acima dos limites`,
    });
  }
  if (periodBills.length > 0) {
    const paidCount = periodBills.length - pending.length;
    rings.push({
      key: "paid",
      label: "Contas pagas",
      value: paidCount / periodBills.length,
      caption: pending.length === 0 ? "todas pagas" : `${pending.length} de ${periodBills.length} em aberto`,
    });
  }
  const investBills = periodBills.filter((b) => b.category === "investimentos");
  const investGoal = investBills.reduce((s, b) => s + b.amount, 0);
  if (investGoal > 0) {
    const investDone = investBills.filter((b) => b.isPaid).reduce((s, b) => s + b.amount, 0);
    rings.push({
      key: "invest",
      label: "Aporte",
      value: investDone / investGoal,
      caption: `${BRL(investDone)} de ${BRL(investGoal)}`,
    });
  }

  // ── Um insight (o melhor, não uma lista): o do Radar da semana, senão calculado agora ──
  const storedInsight: StoredInsight | undefined = stored.find((i) => i.vote !== -1 && i.title !== MULTI_CARD_TITLE);
  const insight: Insight | null = storedInsight
    ? { ...storedInsight }
    : pickInsight({
        byCategory: spending.byCategory as Record<string, number>,
        cards,
    periodBills,
    prevBills,
    budgets,
    alerts,
    projected,
    now,
  });

  const label = `${MONTHS[period.month - 1]}/${period.year}`;
  const summary =
    periodBills.length === 0
      ? `Nenhuma conta lançada em ${label} ainda.`
      : pendingTotal > 0
        ? `Faltam ${BRL(pendingTotal)} em ${pending.length} conta${pending.length > 1 ? "s" : ""} de ${MONTHS[period.month - 1]}. Saldo projetado: ${BRL(projected)}.`
        : `Tudo pago em ${MONTHS[period.month - 1]}. Saldo projetado: ${BRL(projected)}.`;

  const billById = new Map([...prevBills, ...periodBills, ...afterBills].map((b) => [b.id, b]));
  const suggestions: MatchSuggestion[] = suggestedTxs
    .filter((t) => t.billId && billById.has(t.billId) && !billById.get(t.billId)!.isPaid)
    .map((t) => ({
      txId: t.id,
      billId: t.billId as number,
      billName: billById.get(t.billId as number)!.name,
      amount: Math.abs(t.amount),
      date: t.date,
      description: t.description,
    }));

  return {
    period: { ...period, label },
    summary,
    pendingTotal,
    pendingCount: pending.length,
    projected,
    income,
    totalBills,
    debtTotal,
    upcoming: upcoming.slice(0, 8),
    rings,
    insight,
    // Sem cartões (bloco próprio), investimentos e contas que você não usa (poupança zerada).
    accounts: accounts
      .filter((a) => a.type !== "investment" && a.type !== "credit")
      .filter((a) => !(a.type === "savings" && Math.abs(a.balance) < 0.01))
      .map((a) => ({ id: a.id, name: a.name, type: a.type, balance: a.balance, ownership: a.ownership, lastSyncAt: a.lastSyncAt })),
    cards,
    suggestions,
  };
}

type BillRow = Awaited<ReturnType<typeof billsOf>>[number];

const MULTI_CARD_TITLE = "Múltiplos cartões em uso";

function pickInsight({
  byCategory,
  cards,
  periodBills,
  prevBills,
  budgets,
  alerts,
  projected,
  now,
}: {
  byCategory: Record<string, number>;
  cards: CardUsage[];
  periodBills: BillRow[];
  prevBills: BillRow[];
  budgets: { category: string; amount: number }[];
  alerts: { severity: string; title: string; message: string }[];
  projected: number;
  now: Date;
}): Insight | null {
  // 1. Categoria que estourou o limite (o fato mais acionável)
  const over = budgets
    .map((b) => {
      const spent = byCategory[b.category] ?? 0;
      return { category: b.category, spent, limit: b.amount, ratio: b.amount > 0 ? spent / b.amount : 0 };
    })
    .filter((c) => c.ratio > 1)
    .sort((a, b) => b.ratio - a.ratio)[0];
  if (over) {
    return {
      tone: "negative",
      title: `${over.category.charAt(0).toUpperCase()}${over.category.slice(1)} passou do limite`,
      message: `${BRL(over.spent)} lançados contra um limite de ${BRL(over.limit)} (${Math.round((over.ratio - 1) * 100)}% acima). Vale rever na Revisão desta semana.`,
    };
  }

  // 1b. Cartão acima do limite planejado
  const overCard = cards.filter((c) => c.ratio !== null && c.ratio > 1).sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0];
  if (overCard) {
    return {
      tone: "negative",
      title: `${overCard.name} passou do planejado`,
      message: `${BRL(overCard.used)} no mês contra ${BRL(overCard.monthlyLimit)} planejados (${BRL(overCard.used - overCard.monthlyLimit)} acima).`,
      action: "Segure novas compras nesse cartão até a próxima fatura.",
    };
  }

  // 2. Saldo projetado negativo
  if (projected < 0) {
    return {
      tone: "negative",
      title: "O mês não fecha",
      message: `As contas superam as entradas em ${BRL(-projected)}. Escolha o que adiar ou cortar antes do vencimento.`,
    };
  }

  // 3. Alertas de risco (persistidos pelo cron ou calculados agora). "Múltiplos cartões" saiu (v3).
  const relevant = alerts.filter((a) => a.title !== MULTI_CARD_TITLE);
  const pool = relevant.length > 0 ? relevant : detectRisks(periodBills, prevBills);
  const risk = pool.find((a) => a.severity === "danger") ?? pool[0];
  if (risk) {
    return { tone: risk.severity === "danger" ? "negative" : "warning", title: risk.title, message: risk.message };
  }

  // 4. Fôlego: quanto o saldo cobre do gasto médio diário
  const total = periodBills.reduce((s, b) => s + b.amount, 0);
  if (projected > 0 && total > 0) {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const days = Math.floor(projected / (total / daysInMonth));
    return {
      tone: "positive",
      title: "Mês sob controle",
      message: `O saldo projetado de ${BRL(projected)} cobre cerca de ${days} dias de gastos normais.`,
    };
  }
  return null;
}
