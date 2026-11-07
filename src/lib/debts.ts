// Saldo devedor das dívidas: total da dívida − soma das contas vinculadas (debt_bill_links).
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export interface DebtBalance {
  id: number;
  name: string;
  amount: number;
  paid: number;
  remaining: number;
  isPaid: boolean;
  /** Projeção de quitação no ritmo atual ("ago/2027"), pela média mensal das contas vinculadas. */
  payoff: string | null;
}

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function projectPayoff(remaining: number, payments: { month: number; year: number; amount: number }[], now: Date) {
  if (remaining <= 0 || payments.length === 0) return null;
  const months = new Set(payments.map((p) => `${p.year}-${p.month}`)).size;
  const perMonth = payments.reduce((s, p) => s + p.amount, 0) / months;
  if (perMonth <= 0) return null;
  const left = Math.ceil(remaining / perMonth);
  const d = new Date(now.getFullYear(), now.getMonth() + left, 1);
  return `${SHORT_MONTHS[d.getMonth()]}/${d.getFullYear()}`;
}

export async function getDebtBalances(userId: number, now = new Date()): Promise<DebtBalance[]> {
  const [debts, links] = await Promise.all([
    db.query.debts.findMany({ where: eq(schema.debts.userId, userId), orderBy: [schema.debts.createdAt] }),
    db.query.debtBillLinks.findMany({ where: eq(schema.debtBillLinks.userId, userId), with: { bill: true } }),
  ]);
  return debts.map((d) => {
    const payments = links
      .filter((l) => l.debtId === d.id && l.bill)
      .map((l) => ({ month: l.bill.month, year: l.bill.year, amount: l.bill.amount }));
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(d.amount - paid, 0);
    return {
      id: d.id,
      name: d.name,
      amount: d.amount,
      paid,
      remaining,
      isPaid: Boolean(d.isPaid),
      payoff: d.isPaid ? null : projectPayoff(remaining, payments, now),
    };
  });
}

export function totalDebt(balances: DebtBalance[]) {
  return balances.filter((d) => !d.isPaid).reduce((s, d) => s + d.remaining, 0);
}
