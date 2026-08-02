import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { getSession } from "@/lib/auth";

/*
 * Dashboard central do Método 3C.
 * Entrega os dois pilares da plataforma:
 *  - Controle por horizonte de tempo (semana -> mês)
 *  - Comparação efetiva entre meses (mês selecionado vs anterior)
 *
 * Use explicit selects for dashboard aggregates so older DB instances
 * that are missing newer columns in bills still work for this endpoint.
 */

type BillRow = {
  id: number;
  name: string;
  month: number;
  amount: number;
  isPaid: boolean | null;
  dueDay: number | null;
  category: string | null;
  installment: string | null;
};

type SalaryRow = { month: number; amount: number };

// ─── Recorrência (derivada do campo installment, igual ao motor de risco) ───────
function isFixed(b: BillRow) {
  return (b.installment || "").toUpperCase().trim() === "SEMPRE";
}
function isInstallment(b: BillRow) {
  return /^\d+\/\d+$/.test((b.installment || "").trim());
}

function aggregate(bills: BillRow[], salaries: SalaryRow[]) {
  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const paidBills = bills.filter((b) => b.isPaid).reduce((s, b) => s + b.amount, 0);
  const pendingBills = bills.filter((b) => !b.isPaid).reduce((s, b) => s + b.amount, 0);
  const totalIncome = salaries.reduce((s, b) => s + b.amount, 0);

  // Composição por recorrência
  const fixo = bills.filter(isFixed).reduce((s, b) => s + b.amount, 0);
  const parcelado = bills.filter(isInstallment).reduce((s, b) => s + b.amount, 0);
  const eventual = bills
    .filter((b) => !isFixed(b) && !isInstallment(b))
    .reduce((s, b) => s + b.amount, 0);

  // Composição por categoria
  const byCategoryMap = new Map<string, number>();
  for (const b of bills) {
    const key = b.category?.trim() || "sem categoria";
    byCategoryMap.set(key, (byCategoryMap.get(key) || 0) + b.amount);
  }
  const byCategory = Array.from(byCategoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalBills,
    paidBills,
    pendingBills,
    totalIncome,
    balance: totalIncome - totalBills,
    billCount: bills.length,
    paidCount: bills.filter((b) => b.isPaid).length,
    byRecurrence: { fixo, parcelado, eventual },
    byCategory,
  };
}

function billSelect(userId: number, year: number) {
  return db
    .select({
      id: schema.bills.id,
      name: schema.bills.name,
      month: schema.bills.month,
      amount: schema.bills.amount,
      isPaid: schema.bills.isPaid,
      dueDay: schema.bills.dueDay,
      category: schema.bills.category,
      installment: schema.bills.installment,
    })
    .from(schema.bills)
    .where(and(eq(schema.bills.userId, userId), eq(schema.bills.year, year)));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const now = new Date();
  const year = Number.parseInt(
    req.nextUrl.searchParams.get("year") || String(now.getFullYear()),
    10,
  );
  const month = Number.parseInt(
    req.nextUrl.searchParams.get("month") || String(now.getMonth() + 1),
    10,
  );

  // Bills + salários do ano selecionado (base para o gráfico anual e o mês atual)
  const billsYear = await billSelect(user.id, year);
  const salariesYear = await db
    .select({ month: schema.salaries.month, amount: schema.salaries.amount })
    .from(schema.salaries)
    .where(and(eq(schema.salaries.userId, user.id), eq(schema.salaries.year, year)));

  // Agregado dos 12 meses (gráfico anual + grade)
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const mb = billsYear.filter((b) => b.month === m);
    const ms = salariesYear.filter((s) => s.month === m);
    const a = aggregate(mb, ms);
    return {
      month: m,
      totalBills: a.totalBills,
      paidBills: a.paidBills,
      pendingBills: a.pendingBills,
      totalIncome: a.totalIncome,
      balance: a.balance,
      billCount: a.billCount,
      paidCount: a.paidCount,
    };
  });

  // Mês selecionado (com breakdowns)
  const current = aggregate(
    billsYear.filter((b) => b.month === month),
    salariesYear.filter((s) => s.month === month),
  );

  // Mês anterior (cruza a virada de ano) — para a comparação efetiva
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevBills =
    prevYear === year
      ? billsYear.filter((b) => b.month === prevMonth)
      : await billSelect(user.id, prevYear).then((rows) =>
          rows.filter((b) => b.month === prevMonth),
        );
  const prevSalaries =
    prevYear === year
      ? salariesYear.filter((s) => s.month === prevMonth)
      : await db
          .select({ month: schema.salaries.month, amount: schema.salaries.amount })
          .from(schema.salaries)
          .where(
            and(
              eq(schema.salaries.userId, user.id),
              eq(schema.salaries.year, prevYear),
            ),
          )
          .then((rows) => rows.filter((s) => s.month === prevMonth));
  const previous = aggregate(prevBills, prevSalaries);

  // ─── Horizonte da semana ──────────────────────────────────────────────────
  // Contas a vencer nos próximos 7 dias (via dueDay) — olha o mês selecionado e
  // o mês seguinte, para cobrir a virada de mês.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextBills =
    nextYear === year
      ? billsYear.filter((b) => b.month === nextMonth)
      : await billSelect(user.id, nextYear).then((rows) =>
          rows.filter((b) => b.month === nextMonth),
        );

  const dueCandidates = [
    ...billsYear
      .filter((b) => b.month === month)
      .map((b) => ({ b, y: year, m: month })),
    ...nextBills.map((b) => ({ b, y: nextYear, m: nextMonth })),
  ];
  const upcoming = dueCandidates
    .filter(({ b }) => b.dueDay && !b.isPaid)
    .map(({ b, y, m }) => {
      const dueDate = new Date(y, m - 1, b.dueDay as number);
      return { id: b.id, name: b.name, amount: b.amount, dueDate };
    })
    .filter((u) => u.dueDate >= today && u.dueDate <= weekEnd)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 8)
    .map((u) => ({
      id: u.id,
      name: u.name,
      amount: u.amount,
      dueDate: iso(u.dueDate),
    }));

  // Gastos de cartão (crédito + alimentação) nos últimos 7 dias
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const startStr = iso(weekStart);
  const endStr = iso(today);

  const userBillIds = (
    await db
      .select({ id: schema.bills.id })
      .from(schema.bills)
      .where(eq(schema.bills.userId, user.id))
  ).map((r) => r.id);
  const userMealCardIds = (
    await db
      .select({ id: schema.mealCards.id })
      .from(schema.mealCards)
      .where(eq(schema.mealCards.userId, user.id))
  ).map((r) => r.id);

  let cardSpendWeek = 0;
  if (userBillIds.length > 0) {
    const rows = await db
      .select({ amount: schema.cardTransactions.amount })
      .from(schema.cardTransactions)
      .where(
        and(
          inArray(schema.cardTransactions.billId, userBillIds),
          gte(schema.cardTransactions.date, startStr),
          lte(schema.cardTransactions.date, endStr),
        ),
      );
    cardSpendWeek += rows.reduce((s, r) => s + r.amount, 0);
  }
  if (userMealCardIds.length > 0) {
    const rows = await db
      .select({ amount: schema.mealCardTransactions.amount })
      .from(schema.mealCardTransactions)
      .where(
        and(
          inArray(schema.mealCardTransactions.mealCardId, userMealCardIds),
          gte(schema.mealCardTransactions.date, startStr),
          lte(schema.mealCardTransactions.date, endStr),
        ),
      );
    cardSpendWeek += rows.reduce((s, r) => s + r.amount, 0);
  }

  return NextResponse.json({
    year,
    month,
    months,
    current,
    previous,
    week: { upcoming, cardSpend: cardSpendWeek },
  });
}
