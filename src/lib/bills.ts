// Efeitos colaterais de pagar/desmarcar uma conta.
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

type Bill = typeof schema.bills.$inferSelect;

// Aporte: conta paga com investment_id soma no aplicado (e no saldo) do investimento; desmarcar desfaz.
// Assim o aporte deixa de ser só "gasto" e vira transferência para o patrimônio.
export async function applyPaidSideEffects(userId: number, before: Bill, after: Bill) {
  if (!after.investmentId || Boolean(before.isPaid) === Boolean(after.isPaid)) return;
  const delta = after.isPaid ? after.amount : -before.amount;
  await db
    .update(schema.investments)
    .set({
      appliedAmount: sql`${schema.investments.appliedAmount} + ${delta}`,
      balance: sql`${schema.investments.balance} + ${delta}`,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(schema.investments.id, after.investmentId), eq(schema.investments.userId, userId)));
}

export async function setBillPaid(userId: number, billId: number, isPaid: boolean, date?: string) {
  const before = await db.query.bills.findFirst({
    where: and(eq(schema.bills.id, billId), eq(schema.bills.userId, userId)),
  });
  if (!before) return null;
  const [after] = await db
    .update(schema.bills)
    .set({ isPaid, ...(date && isPaid && !before.date ? { date } : {}), updatedAt: new Date().toISOString() })
    .where(eq(schema.bills.id, billId))
    .returning();
  await applyPaidSideEffects(userId, before, after);
  return after;
}
