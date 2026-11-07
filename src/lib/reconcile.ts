// Conciliação: liga saídas bancárias (Pluggy ou importação) às contas do mês.
// Regra: valor igual (±1%) e vencimento a ±5 dias → status 'suggested' (Hoje pede confirmação).
// Sem par → fica 'pending' e vai para "a categorizar" na Revisão.
import { and, eq, inArray } from "drizzle-orm";
import { setBillPaid } from "@/lib/bills";
import { db, schema } from "@/lib/db";

const AMOUNT_TOLERANCE = 0.01;
const DAY_TOLERANCE = 5;

type Bill = typeof schema.bills.$inferSelect;
type BankTx = typeof schema.bankTransactions.$inferSelect;

function daysBetween(a: string, b: string) {
  return Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 86_400_000;
}

function billDueDate(bill: Bill) {
  if (!bill.dueDay) return null;
  return `${bill.year}-${String(bill.month).padStart(2, "0")}-${String(bill.dueDay).padStart(2, "0")}`;
}

// Puro (testável): escolhe a melhor conta para uma saída, ou null.
export function findBillMatch(tx: Pick<BankTx, "amount" | "date">, bills: Bill[], taken: Set<number>) {
  if (tx.amount >= 0) return null;
  const value = Math.abs(tx.amount);
  let best: { bill: Bill; score: number } | null = null;
  for (const bill of bills) {
    if (bill.isPaid || taken.has(bill.id) || bill.amount <= 0) continue;
    const due = billDueDate(bill);
    if (!due) continue;
    const diffAmount = Math.abs(bill.amount - value) / bill.amount;
    const diffDays = daysBetween(due, tx.date);
    if (diffAmount > AMOUNT_TOLERANCE || diffDays > DAY_TOLERANCE) continue;
    const score = diffAmount * 100 + diffDays;
    if (!best || score < best.score) best = { bill, score };
  }
  return best?.bill ?? null;
}

function monthsAround(date: string) {
  const [y, m] = date.split("-").map(Number);
  const prev = m === 1 ? { month: 12, year: y - 1 } : { month: m - 1, year: y };
  const next = m === 12 ? { month: 1, year: y + 1 } : { month: m + 1, year: y };
  return [prev, { month: m, year: y }, next];
}

export async function reconcilePending(userId: number) {
  const pending = await db.query.bankTransactions.findMany({
    where: and(eq(schema.bankTransactions.userId, userId), eq(schema.bankTransactions.status, "pending")),
  });
  const outflows = pending.filter((t) => t.amount < 0);
  if (outflows.length === 0) return 0;

  const periods = new Map<string, { month: number; year: number }>();
  for (const t of outflows) for (const p of monthsAround(t.date)) periods.set(`${p.year}-${p.month}`, p);

  const bills: Bill[] = [];
  for (const p of Array.from(periods.values())) {
    bills.push(
      ...(await db.query.bills.findMany({
        where: and(eq(schema.bills.userId, userId), eq(schema.bills.month, p.month), eq(schema.bills.year, p.year)),
      })),
    );
  }

  // Contas que já têm sugestão/confirmação não entram de novo.
  const linked = await db.query.bankTransactions.findMany({
    where: and(
      eq(schema.bankTransactions.userId, userId),
      inArray(schema.bankTransactions.status, ["suggested", "matched"]),
    ),
  });
  const taken = new Set(linked.map((t) => t.billId).filter((id): id is number => id !== null));

  let matched = 0;
  for (const tx of outflows) {
    const bill = findBillMatch(tx, bills, taken);
    if (!bill) continue;
    taken.add(bill.id);
    await db
      .update(schema.bankTransactions)
      .set({ status: "suggested", billId: bill.id, category: tx.category ?? bill.category })
      .where(eq(schema.bankTransactions.id, tx.id));
    matched++;
  }
  return matched;
}

// Confirma a sugestão: marca a conta como paga na data da transação.
export async function confirmMatch(userId: number, txId: number) {
  const tx = await db.query.bankTransactions.findFirst({
    where: and(eq(schema.bankTransactions.id, txId), eq(schema.bankTransactions.userId, userId)),
  });
  if (!tx?.billId) return false;
  await setBillPaid(userId, tx.billId, true, tx.date);
  await db.update(schema.bankTransactions).set({ status: "matched" }).where(eq(schema.bankTransactions.id, tx.id));
  return true;
}
