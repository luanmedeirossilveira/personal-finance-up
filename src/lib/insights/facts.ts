// Camada 1 dos insights: fatos calculados (determinístico). O modelo só redige e prioriza;
// todo número que aparece num insight nasce aqui.
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { normalizeCategory } from "@/lib/categories";
import { getCardsUsage } from "@/lib/cards";
import { getDebtBalances } from "@/lib/debts";
import { detectRisks } from "@/lib/risk";
import { BRL, getDefaultPeriod, todayISO } from "@/lib/month";
import { reviewedWeek } from "@/lib/revisao-shared";

export type FactType =
  | "card_over_plan"
  | "category_pace"
  | "new_subscription"
  | "installments"
  | "debt_payoff"
  | "decision"
  | "runway"
  | "installments_growth"
  | "fixed_growth"
  | "card_recurrence";

export type Tone = "positive" | "warning" | "negative";

export interface Fact {
  type: FactType;
  tone: Tone;
  /** 0..100: quanto mais alto, mais urgente/relevante. */
  weight: number;
  /** Números agregados (sem descrição de transação nem nome de banco) — vão para o Gemini. */
  data: Record<string, string | number | boolean | null>;
  /** Frase-modelo usada sem IA (fallback). */
  title: string;
  message: string;
  action: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function normalizeDesc(d: string) {
  return d
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\d+/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Puro (testável): saídas que se repetem mês a mês e não existiam antes de 60 dias atrás.
export function detectNewSubscriptions(
  txs: { date: string; amount: number; description: string }[],
  today: string,
) {
  const cutoff = new Date(`${today}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = todayISO(cutoff);
  const groups = new Map<string, { date: string; amount: number }[]>();
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const key = normalizeDesc(t.description);
    if (key.length < 3) continue;
    groups.set(key, [...(groups.get(key) ?? []), { date: t.date, amount: Math.abs(t.amount) }]);
  }
  const found: { amount: number; since: string }[] = [];
  for (const list of Array.from(groups.values())) {
    const months = new Set(list.map((t) => t.date.slice(0, 7)));
    if (months.size < 2) continue;
    const amounts = list.map((t) => t.amount);
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    if (amounts.some((a) => Math.abs(a - avg) / avg > 0.1)) continue;
    const first = list.map((t) => t.date).sort()[0];
    if (first >= cutoffStr) found.push({ amount: Math.round(avg * 100) / 100, since: first });
  }
  return found;
}

// Puro (testável): soma das parcelas "n/m" que ainda caem nos próximos `months` meses.
export function committedInstallments(items: { amount: number; installment: string | null }[], months = 6) {
  const perMonth = Array.from({ length: months }, () => 0);
  let lastMonth = 0;
  for (const it of items) {
    const m = /^(\d+)\s*\/\s*(\d+)$/.exec((it.installment || "").trim());
    if (!m) continue;
    const current = Number(m[1]);
    const total = Number(m[2]);
    for (let k = 1; k <= months; k++) {
      if (current + k <= total) {
        perMonth[k - 1] += it.amount;
        lastMonth = Math.max(lastMonth, k);
      }
    }
  }
  return { perMonth, lastMonth };
}

export async function computeFacts(userId: number, now = new Date()): Promise<Fact[]> {
  const facts: Fact[] = [];
  const today = todayISO(now);
  const calMonth = now.getMonth() + 1;
  const calYear = now.getFullYear();
  const monthStart = `${calYear}-${pad(calMonth)}-01`;
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const dayOfMonth = now.getDate();
  const period = getDefaultPeriod(now);
  const prevPeriod = period.month === 1 ? { month: 12, year: period.year - 1 } : { month: period.month - 1, year: period.year };

  const ninetyAgo = new Date(now);
  ninetyAgo.setDate(ninetyAgo.getDate() - 95);

  const [periodBills, prevBills, salaries, budgets, bankTxs, debts, lastCheckin] = await Promise.all([
    db.query.bills.findMany({
      where: and(eq(schema.bills.userId, userId), eq(schema.bills.month, period.month), eq(schema.bills.year, period.year)),
    }),
    db.query.bills.findMany({
      where: and(eq(schema.bills.userId, userId), eq(schema.bills.month, prevPeriod.month), eq(schema.bills.year, prevPeriod.year)),
    }),
    db.query.salaries.findMany({
      where: and(eq(schema.salaries.userId, userId), eq(schema.salaries.month, period.month), eq(schema.salaries.year, period.year)),
    }),
    db.query.categoryBudgets.findMany({
      where: and(
        eq(schema.categoryBudgets.userId, userId),
        inArray(schema.categoryBudgets.month, [calMonth, period.month]),
        inArray(schema.categoryBudgets.year, [calYear, period.year]),
      ),
    }),
    db.query.bankTransactions.findMany({
      where: and(eq(schema.bankTransactions.userId, userId), gte(schema.bankTransactions.date, todayISO(ninetyAgo))),
    }),
    getDebtBalances(userId, now),
    db.query.weeklyCheckins.findFirst({
      where: and(eq(schema.weeklyCheckins.userId, userId), inArray(schema.weeklyCheckins.type, ["weekly", "monthly"])),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    }),
  ]);

  // Gasto variável do mês corrente: compras no cartão + saídas bancárias não ligadas a contas.
  const cardBillIds = (
    await db.select({ id: schema.bills.id }).from(schema.bills).where(eq(schema.bills.userId, userId))
  ).map((r) => r.id);
  const cardTxs = cardBillIds.length
    ? await db
        .select({ amount: schema.cardTransactions.amount, category: schema.cardTransactions.category, date: schema.cardTransactions.date })
        .from(schema.cardTransactions)
        .where(
          and(
            inArray(schema.cardTransactions.billId, cardBillIds),
            gte(schema.cardTransactions.date, monthStart),
            lte(schema.cardTransactions.date, today),
          ),
        )
    : [];
  const variable = [
    ...cardTxs.map((t) => ({ amount: t.amount, category: t.category, date: t.date ?? today })),
    ...bankTxs
      .filter((t) => t.amount < 0 && t.date >= monthStart && !t.billId && !t.cardTransactionId && t.status !== "ignored")
      .map((t) => ({ amount: Math.abs(t.amount), category: t.category, date: t.date })),
  ];

  // ── Ritmo da categoria ────────────────────────────────────────────────────
  const monthBudgets = budgets.filter((b) => b.month === calMonth && b.year === calYear);
  const useBudgets = monthBudgets.length ? monthBudgets : budgets.filter((b) => b.month === period.month && b.year === period.year);
  if (dayOfMonth >= 5) {
    for (const b of useBudgets) {
      const spent = variable.filter((v) => normalizeCategory(v.category) === b.category).reduce((s, v) => s + v.amount, 0);
      if (spent <= 0 || b.amount <= 0) continue;
      const projected = (spent / dayOfMonth) * daysInMonth;
      const ratio = projected / b.amount;
      if (ratio < 1.05) continue;
      const pct = Math.round((ratio - 1) * 100);
      facts.push({
        type: "category_pace",
        tone: ratio > 1.25 ? "negative" : "warning",
        weight: Math.min(90, 50 + pct),
        data: { categoria: b.category, gastoAteHoje: spent, projecaoFimDoMes: Math.round(projected), limite: b.amount, acimaPct: pct },
        title: `${cap(b.category)} vai passar do limite`,
        message: `${cap(b.category)} vai fechar em ${BRL(projected)}, ${pct}% acima do limite de ${BRL(b.amount)} no ritmo atual.`,
        action: `Segurar ${b.category} até o fim do mês: sobram ${BRL(Math.max(b.amount - spent, 0))}.`,
      });
    }
  }

  // ── Assinatura nova ───────────────────────────────────────────────────────
  for (const sub of detectNewSubscriptions(bankTxs, today).slice(0, 2)) {
    const [y, m] = sub.since.split("-");
    facts.push({
      type: "new_subscription",
      tone: "warning",
      weight: 45,
      data: { valorMensal: sub.amount, desde: `${m}/${y}` },
      title: "Nova cobrança recorrente",
      message: `Nova cobrança mensal de ${BRL(sub.amount)} desde ${m}/${y}.`,
      action: "Confirme se essa assinatura ainda faz sentido.",
    });
  }

  // ── Parcelas comprometidas ────────────────────────────────────────────────
  const { perMonth, lastMonth } = committedInstallments(periodBills);
  const avgCommitted = perMonth.reduce((s, v) => s + v, 0) / perMonth.length;
  if (avgCommitted > 0 && lastMonth > 0) {
    const until = new Date(period.year, period.month - 1 + lastMonth, 1).toLocaleDateString("pt-BR", { month: "long" });
    const income = salaries.reduce((s, x) => s + x.amount, 0);
    const share = income > 0 ? Math.round((perMonth[0] / income) * 100) : null;
    facts.push({
      type: "installments",
      tone: share !== null && share > 30 ? "negative" : "warning",
      weight: share !== null ? Math.min(80, 20 + share) : 35,
      data: { mediaMensal: Math.round(avgCommitted), proximoMes: Math.round(perMonth[0]), ateMes: until, pctDaRenda: share },
      title: "Parcelas já comprometidas",
      message: `${BRL(perMonth[0])}/mês já comprometidos em parcelas, até ${until}${share !== null ? ` (${share}% das entradas)` : ""}.`,
      action: "Evite novos parcelamentos até essa conta baixar.",
    });
  }

  // ── Dívidas ───────────────────────────────────────────────────────────────
  const withPayoff = debts.filter((d) => !d.isPaid && d.payoff).sort((a, b) => b.remaining - a.remaining)[0];
  if (withPayoff) {
    facts.push({
      type: "debt_payoff",
      tone: "positive",
      weight: 30,
      data: { saldoDevedor: withPayoff.remaining, quitacaoPrevista: withPayoff.payoff, pagoAteAgora: withPayoff.paid },
      title: "Quitação no ritmo atual",
      message: `No ritmo atual, a maior dívida (${BRL(withPayoff.remaining)} restantes) quita em ${withPayoff.payoff}.`,
      action: "Qualquer valor extra este mês antecipa a quitação.",
    });
  }

  // ── Decisão da Revisão vs. dados ──────────────────────────────────────────
  if (lastCheckin) {
    let decision: string | undefined;
    try {
      decision = (JSON.parse(lastCheckin.data) as { decision?: string }).decision;
    } catch {
      decision = undefined;
    }
    if (decision) {
      const week = reviewedWeek(new Date(now.getTime() + 7 * 86_400_000)); // semana corrente
      const weekVar = variable.filter((v) => v.date >= week.start && v.date <= week.end);
      const spentWeek = weekVar.reduce((s, v) => s + v.amount, 0);
      const byCat: Record<string, number> = {};
      for (const v of weekVar) byCat[v.category || "outros"] = (byCat[v.category || "outros"] ?? 0) + 1;
      facts.push({
        type: "decision",
        tone: "warning",
        weight: 40,
        data: { decisao: decision.slice(0, 200), comprasNaSemana: weekVar.length, gastoNaSemana: Math.round(spentWeek), comprasPorCategoria: JSON.stringify(byCat) },
        title: "Sua decisão da semana",
        message: `Você decidiu: "${decision.slice(0, 120)}". Desde então foram ${weekVar.length} compras variáveis (${BRL(spentWeek)}).`,
        action: "Na próxima Revisão, marque se a decisão foi cumprida.",
      });
    }
  }

  // ── Fôlego ────────────────────────────────────────────────────────────────
  const income = salaries.reduce((s, x) => s + x.amount, 0);
  const totalBills = periodBills.reduce((s, b) => s + b.amount, 0);
  const projected = income - totalBills;
  if (totalBills > 0) {
    const daily = totalBills / daysInMonth;
    const days = Math.floor(projected / daily);
    facts.push({
      type: "runway",
      tone: projected < 0 ? "negative" : days < 10 ? "warning" : "positive",
      weight: projected < 0 ? 95 : days < 10 ? 60 : 15,
      data: { saldoProjetado: Math.round(projected), gastoMedioDiario: Math.round(daily), diasCobertos: Math.max(days, 0) },
      title: projected < 0 ? "O mês não fecha" : "Fôlego do mês",
      message:
        projected < 0
          ? `As contas superam as entradas em ${BRL(-projected)}.`
          : `O saldo projetado de ${BRL(projected)} cobre ${days} dias de gastos normais.`,
      action: projected < 0 ? "Escolha o que adiar ou cortar antes do vencimento." : "Considere antecipar um aporte.",
    });
  }

  // ── Cartão acima do limite planejado (substitui "múltiplos cartões") ──────
  for (const c of await getCardsUsage(userId, period.month, period.year)) {
    if (c.ratio === null || c.ratio < 0.8) continue;
    const over = c.used - c.monthlyLimit;
    facts.push({
      type: "card_over_plan",
      tone: c.ratio > 1 ? "negative" : "warning",
      weight: c.ratio > 1 ? Math.min(92, 60 + Math.round((c.ratio - 1) * 100)) : 45,
      data: { cartao: c.name, usado: Math.round(c.used * 100) / 100, planejado: c.monthlyLimit, acimaPct: Math.round((c.ratio - 1) * 100) },
      title: c.ratio > 1 ? `${c.name} passou do planejado` : `${c.name} perto do planejado`,
      message:
        c.ratio > 1
          ? `${c.name}: ${BRL(c.used)} no mês contra ${BRL(c.monthlyLimit)} planejados (${BRL(over)} acima).`
          : `${c.name}: ${BRL(c.used)} de ${BRL(c.monthlyLimit)} planejados (${Math.round(c.ratio * 100)}%).`,
      action: c.ratio > 1 ? "Segure novas compras nesse cartão até a próxima fatura." : `Restam ${BRL(-over)} no planejado deste cartão.`,
    });
  }

  // ── Alertas de risco viram linhas desta tabela ────────────────────────────
  for (const r of detectRisks(periodBills, prevBills)) {
    facts.push({
      type: r.type,
      tone: r.severity === "danger" ? "negative" : "warning",
      weight: r.severity === "danger" ? 75 : 50,
      data: { severidade: r.severity },
      title: r.title,
      message: r.message,
      action: "Revise na próxima Revisão semanal.",
    });
  }

  return facts.sort((a, b) => b.weight - a.weight);
}
