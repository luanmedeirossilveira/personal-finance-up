// Exportação do Mês em Markdown, para colar numa conversa com o Claude e tirar dúvidas.
// Coleta (banco) separada da renderização (pura, testável), como nos fatos dos insights.
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { categoryLabel } from "@/lib/categories";
import { getCardsUsage } from "@/lib/cards";
import { getDebtBalances } from "@/lib/debts";
import { committedInstallments } from "@/lib/insights/facts";
import { BRL, MONTHS, formatDateBR, todayISO } from "@/lib/month";
import { getClosing } from "@/lib/month-closing";
import { getMonthSpending } from "@/lib/month-spending";

type Ownership = "mine" | "hers" | "joint";

export interface MonthTotals {
  income: number;
  outflow: number;
  invested: number;
  byCategory: Record<string, number>;
}

export interface MonthExport {
  month: number;
  year: number;
  generatedAt: string;
  closed: boolean;
  salaries: { person: string; amount: number }[];
  bills: {
    name: string;
    amount: number;
    category: string | null;
    ownership: Ownership;
    dueDay: number | null;
    date: string | null;
    isPaid: boolean;
    installment: string | null;
    type: string | null;
  }[];
  invoices: {
    name: string;
    total: number;
    undetailed: number;
    purchases: { name: string; amount: number; category: string | null; date: string | null; installment: string | null; recurring: boolean }[];
  }[];
  meal: { limit: number; spent: number; purchases: { name: string; amount: number; category: string; date: string | null; origin: string | null }[] };
  byCategory: Record<string, number>;
  budgets: Record<string, number>;
  cards: { name: string; ownership: Ownership; monthlyLimit: number; used: number; openBill: number | null }[];
  bank: { balance: number; label: string } | null;
  future: { name: string; amount: number | null; reminderDate: string | null; priority: string | null; notes: string | null }[];
  /** Parcelas já comprometidas nos 6 meses seguintes ao mês exportado. */
  installments: number[];
  /** Compras recorrentes do cartão (assinaturas): repetem todo mês. */
  recurringMonthly: number;
  debts: { name: string; amount: number; paid: number; remaining: number; isPaid: boolean; payoff: string | null }[];
  /** Os 3 meses anteriores, do mais antigo ao mais recente. */
  history: { month: number; year: number; closed: boolean; totals: MonthTotals }[];
}

const OWNER_LABEL: Record<Ownership, string> = { mine: "minha", hers: "dela", joint: "conjunta" };

const prevPeriod = (month: number, year: number) => (month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year });

const billsOf = (userId: number, month: number, year: number) =>
  db.query.bills.findMany({
    where: and(eq(schema.bills.userId, userId), eq(schema.bills.month, month), eq(schema.bills.year, year)),
    orderBy: (b, { asc }) => [asc(b.name)],
  });

const salariesOf = (userId: number, month: number, year: number) =>
  db.query.salaries.findMany({
    where: and(eq(schema.salaries.userId, userId), eq(schema.salaries.month, month), eq(schema.salaries.year, year)),
  });

async function closingOf(userId: number, month: number, year: number) {
  try {
    return await getClosing(userId, month, year);
  } catch {
    return null; // tabela ainda não migrada
  }
}

// Mês fechado usa o resumo gravado no fechamento; aberto, calcula na hora (mesma conta do fechamento).
async function monthTotals(userId: number, month: number, year: number) {
  const closing = await closingOf(userId, month, year);
  if (closing?.summary?.byCategory) {
    const { income, outflow, invested, byCategory } = closing.summary;
    return { closed: true, totals: { income, outflow, invested, byCategory } };
  }
  const [bills, salaries, spending] = await Promise.all([
    billsOf(userId, month, year),
    salariesOf(userId, month, year),
    getMonthSpending(userId, month, year),
  ]);
  const invested = bills.filter((b) => b.category === "investimentos").reduce((s, b) => s + b.amount, 0);
  return {
    closed: closing !== null,
    totals: {
      income: salaries.reduce((s, x) => s + x.amount, 0),
      outflow: bills.reduce((s, b) => s + b.amount, 0) - invested,
      invested,
      byCategory: spending.byCategory as Record<string, number>,
    },
  };
}

export async function collectMonthExport(userId: number, month: number, year: number, now = new Date()): Promise<MonthExport> {
  const m1 = prevPeriod(month, year);
  const m2 = prevPeriod(m1.month, m1.year);
  const m3 = prevPeriod(m2.month, m2.year);

  const [bills, salaries, closing, spending, budgets, cards, accounts, futureBills, debts, history] = await Promise.all([
    billsOf(userId, month, year),
    salariesOf(userId, month, year),
    closingOf(userId, month, year),
    getMonthSpending(userId, month, year),
    db.query.categoryBudgets.findMany({
      where: and(eq(schema.categoryBudgets.userId, userId), eq(schema.categoryBudgets.month, month), eq(schema.categoryBudgets.year, year)),
    }),
    getCardsUsage(userId, month, year),
    db.query.accounts.findMany({ where: eq(schema.accounts.userId, userId) }),
    db.query.futureBills.findMany({ where: eq(schema.futureBills.userId, userId) }),
    getDebtBalances(userId, now),
    Promise.all([m3, m2, m1].map(async (p) => ({ ...p, ...(await monthTotals(userId, p.month, p.year)) }))),
  ]);

  const cardBills = bills.filter((b) => b.type === "CARD");
  const cardTxs = cardBills.length
    ? await db.query.cardTransactions.findMany({ where: inArray(schema.cardTransactions.billId, cardBills.map((b) => b.id)) })
    : [];

  // Saldo de hoje: corrente/poupança visíveis (mesmo critério do cabeçalho do Mês).
  const cash = accounts.filter((a) => (a.type === "checking" || a.type === "savings") && !a.archived);

  // Previstas do mês: lembrete no mês exportado; sem data, ficam no mês corrente do calendário.
  const isCalendarMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const future = futureBills.filter((f) => {
    if (!f.reminderDate) return isCalendarMonth;
    const [y, m] = f.reminderDate.split("-").map(Number);
    return y === year && m === month;
  });

  return {
    month,
    year,
    generatedAt: todayISO(now),
    closed: closing !== null,
    salaries: salaries.map((s) => ({ person: s.person, amount: s.amount })),
    bills: bills.map((b) => ({
      name: b.name,
      amount: b.amount,
      category: b.category,
      ownership: b.ownership,
      dueDay: b.dueDay,
      date: b.date,
      isPaid: Boolean(b.isPaid),
      installment: b.installment,
      type: b.type,
    })),
    invoices: cardBills.map((b) => {
      const txs = cardTxs.filter((t) => t.billId === b.id);
      return {
        name: b.cardNickname || b.name,
        total: b.amount,
        undetailed: Math.max(b.amount - txs.reduce((s, t) => s + t.amount, 0), 0),
        purchases: txs.map((t) => ({
          name: t.name,
          amount: t.amount,
          category: t.category,
          date: t.date,
          installment: t.installment,
          recurring: t.recurring,
        })),
      };
    }),
    meal: {
      ...spending.meal,
      purchases: spending.lines
        .filter((l) => l.source === "alimentação")
        .map((l) => ({ name: l.name, amount: l.amount, category: l.category, date: l.date, origin: l.origin })),
    },
    byCategory: spending.byCategory as Record<string, number>,
    budgets: Object.fromEntries(budgets.map((b) => [b.category, b.amount])),
    cards: cards.map((c) => ({
      name: c.name,
      ownership: c.ownership,
      monthlyLimit: c.monthlyLimit,
      used: c.used,
      openBill: c.openBill?.amount ?? null,
    })),
    bank: cash.length
      ? { balance: cash.reduce((s, a) => s + a.balance, 0), label: cash.length === 1 ? cash[0].name : `${cash.length} contas` }
      : null,
    future: future.map((f) => ({ name: f.name, amount: f.amount, reminderDate: f.reminderDate, priority: f.priority, notes: f.notes })),
    installments: committedInstallments([
      ...bills,
      ...cardTxs.filter((t) => !t.recurring).map((t) => ({ amount: t.amount, installment: t.installment })),
    ]).perMonth,
    recurringMonthly: cardTxs.filter((t) => t.recurring).reduce((s, t) => s + t.amount, 0),
    debts: debts.map(({ name, amount, paid, remaining, isPaid, payoff }) => ({ name, amount, paid, remaining, isPaid, payoff })),
    history: history.map(({ month, year, closed, totals }) => ({ month, year, closed, totals })),
  };
}

// ── Renderização ────────────────────────────────────────────────────────────

const cell = (v: string | number | null | undefined) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "");
const monthLabel = (month: number, year: number) => `${MONTHS[month - 1]}/${year}`;
const shortMonth = (month: number, year: number) => `${MONTHS[month - 1].slice(0, 3).toLowerCase()}/${String(year).slice(2)}`;

function table(headers: string[], rows: (string | number | null | undefined)[][]) {
  if (rows.length === 0) return "—";
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");
}

export function summarize(data: Pick<MonthExport, "bills" | "salaries">) {
  const income = data.salaries.reduce((s, x) => s + x.amount, 0);
  const invested = data.bills.filter((b) => b.category === "investimentos").reduce((s, b) => s + b.amount, 0);
  const outflow = data.bills.reduce((s, b) => s + b.amount, 0) - invested;
  const pending = data.bills.filter((b) => !b.isPaid).reduce((s, b) => s + b.amount, 0);
  return { income, outflow, invested, pending, balance: income - outflow - invested };
}

export function renderMonthExport(data: MonthExport): string {
  const { month, year } = data;
  const sum = summarize(data);
  const out: string[] = [];

  out.push(
    `# Finanças de ${monthLabel(month, year)}`,
    `Gerado em ${formatDateBR(data.generatedAt)} · mês ${data.closed ? "fechado" : "em aberto"}.`,
    "",
    "> Dados das minhas finanças pessoais (casal), exportados do meu app de contas. Valores em reais (R$). " +
      'Dono: "minha", "dela" ou "conjunta". As contas são lançadas no mês seguinte ao de referência. ' +
      "Faturas de cartão aparecem como uma conta e as compras de cada fatura estão detalhadas abaixo.",
  );

  out.push(
    "",
    "## Resumo",
    `- Entradas: ${BRL(sum.income)}`,
    `- Saídas (sem investimentos): ${BRL(sum.outflow)}`,
    `- Investido: ${BRL(sum.invested)}`,
    `- A pagar (contas em aberto): ${BRL(sum.pending)}`,
    `- Saldo previsto (entradas − saídas − investido): ${BRL(sum.balance)}`,
  );
  if (data.bank) out.push(`- Saldo atual no banco (${data.bank.label}): ${BRL(data.bank.balance)}`);
  if (data.meal.limit > 0) {
    out.push(`- Cartões alimentação: ${BRL(data.meal.spent)} gastos de ${BRL(data.meal.limit)} (saldo ${BRL(data.meal.limit - data.meal.spent)})`);
  }

  out.push(
    "",
    "## Entradas",
    table(["Pessoa", "Valor"], data.salaries.map((s) => [s.person, BRL(s.amount)])),
  );

  out.push(
    "",
    "## Contas do mês",
    table(
      ["Conta", "Valor", "Categoria", "Dono", "Vencimento/data", "Paga", "Parcela", "Tipo"],
      data.bills.map((b) => [
        b.name,
        BRL(b.amount),
        b.type === "CARD" ? "fatura de cartão" : categoryLabel(b.category),
        OWNER_LABEL[b.ownership],
        b.date ? formatDateBR(b.date) : b.dueDay ? `dia ${b.dueDay}` : "",
        b.isPaid ? "sim" : "não",
        b.installment,
        b.type === "CARD" ? "cartão" : "normal",
      ]),
    ),
  );

  out.push("", "## Compras dos cartões de crédito");
  if (data.invoices.length === 0) out.push("—");
  for (const inv of data.invoices) {
    out.push(
      "",
      `### ${inv.name} — fatura de ${BRL(inv.total)}`,
      table(
        ["Compra", "Valor", "Categoria", "Data", "Parcela", "Recorrente"],
        [
          ...inv.purchases.map((p) => [
            p.name,
            BRL(p.amount),
            p.category ? categoryLabel(p.category) : "",
            p.date ? formatDateBR(p.date) : "",
            p.installment,
            p.recurring ? "sim" : "",
          ]),
          ...(inv.undetailed > 0.009 ? [["(não detalhado)", BRL(inv.undetailed), "", "", "", ""]] : []),
        ],
      ),
    );
  }

  out.push(
    "",
    "## Cartões alimentação",
    data.meal.limit > 0 ? `Limite ${BRL(data.meal.limit)} · gasto ${BRL(data.meal.spent)} · saldo ${BRL(data.meal.limit - data.meal.spent)}` : "—",
  );
  if (data.meal.purchases.length > 0) {
    out.push(
      "",
      table(
        ["Compra", "Valor", "Categoria", "Data", "Cartão"],
        data.meal.purchases.map((p) => [p.name, BRL(p.amount), categoryLabel(p.category), p.date ? formatDateBR(p.date) : "", p.origin]),
      ),
    );
  }

  const categories = Array.from(new Set([...Object.keys(data.byCategory), ...Object.keys(data.budgets)])).sort(
    (a, b) => (data.byCategory[b] ?? 0) - (data.byCategory[a] ?? 0),
  );
  out.push(
    "",
    "## Gasto por categoria × limite",
    "Inclui contas, compras do cartão (pela categoria de cada compra) e cartões alimentação.",
    "",
    table(
      ["Categoria", "Gasto", "Limite", "% do limite"],
      categories.map((c) => {
        const spent = data.byCategory[c] ?? 0;
        const limit = data.budgets[c];
        return [categoryLabel(c), BRL(spent), limit ? BRL(limit) : "", limit ? pct(spent, limit) : ""];
      }),
    ),
  );

  out.push(
    "",
    "## Limites planejados por cartão",
    table(
      ["Cartão", "Dono", "Limite planejado", "Usado no mês", "% usado", "Fatura em aberto (banco)"],
      data.cards.map((c) => [
        c.name,
        OWNER_LABEL[c.ownership],
        c.monthlyLimit > 0 ? BRL(c.monthlyLimit) : "",
        BRL(c.used),
        pct(c.used, c.monthlyLimit),
        c.openBill !== null ? BRL(c.openBill) : "",
      ]),
    ),
  );

  out.push(
    "",
    "## Contas previstas (ainda não lançadas)",
    table(
      ["Conta", "Valor", "Data", "Prioridade", "Notas"],
      data.future.map((f) => [
        f.name,
        f.amount !== null ? BRL(f.amount) : "",
        f.reminderDate ? formatDateBR(f.reminderDate) : "",
        f.priority,
        f.notes,
      ]),
    ),
  );

  let next = { month, year };
  const upcoming = data.installments.map((amount) => {
    next = next.month === 12 ? { month: 1, year: next.year + 1 } : { month: next.month + 1, year: next.year };
    return [monthLabel(next.month, next.year), BRL(amount)];
  });
  out.push(
    "",
    "## Parcelas futuras (próximos 6 meses)",
    "Parcelas (n/m) de contas e compras no cartão que ainda vão cair, a partir deste mês.",
    "",
    data.installments.some((v) => v > 0) ? table(["Mês", "Já comprometido"], upcoming) : "—",
  );
  if (data.recurringMonthly > 0) {
    out.push("", `Compras recorrentes no cartão (assinaturas, repetem todo mês): ${BRL(data.recurringMonthly)}/mês.`);
  }

  out.push(
    "",
    "## Dívidas",
    table(
      ["Dívida", "Total", "Pago", "Saldo devedor", "Quitação prevista", "Quitada"],
      data.debts.map((d) => [d.name, BRL(d.amount), BRL(d.paid), BRL(d.remaining), d.payoff, d.isPaid ? "sim" : "não"]),
    ),
  );

  const columns = [
    ...data.history.map((h) => ({ label: `${shortMonth(h.month, h.year)}${h.closed ? "" : "*"}`, totals: h.totals })),
    { label: `${shortMonth(month, year)} (este)`, totals: { ...sum, byCategory: data.byCategory } },
  ];
  const historyCategories = Array.from(new Set(columns.flatMap((c) => Object.keys(c.totals.byCategory ?? {})))).sort(
    (a, b) => (data.byCategory[b] ?? 0) - (data.byCategory[a] ?? 0),
  );
  const row = (label: string, pick: (t: MonthTotals) => number) => [label, ...columns.map((c) => BRL(pick(c.totals)))];
  out.push(
    "",
    "## Últimos meses (comparação)",
    "* = mês ainda não fechado (valores podem mudar).",
    "",
    table(
      ["", ...columns.map((c) => c.label)],
      [
        row("**Entradas**", (t) => t.income),
        row("**Saídas**", (t) => t.outflow),
        row("**Investido**", (t) => t.invested),
        row("**Saldo**", (t) => t.income - t.outflow - t.invested),
        ...historyCategories.map((c) => row(categoryLabel(c), (t) => t.byCategory?.[c] ?? 0)),
      ],
    ),
  );

  return `${out.join("\n")}\n`;
}
