// Contas: criação (site e WhatsApp) e efeitos colaterais de pagar/desmarcar.
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

type Bill = typeof schema.bills.$inferSelect;
type BillOwnership = Bill["ownership"];

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

export const VALID_OWNERSHIP: BillOwnership[] = ["mine", "hers", "joint"];

// Payload do POST /api/bills (vem cru do JSON, por isso os tipos frouxos).
export interface BillInput {
  name: string;
  amount: number | string;
  month: number;
  year: number;
  installment?: string | null;
  isPaid?: boolean;
  dueDay?: number | null;
  category?: string | null;
  notes?: string | null;
  barCode?: string | null;
  qrCode?: string | null;
  type?: string | null;
  cardLast4?: string | null;
  cardNickname?: string | null;
  ownership?: BillOwnership | null;
  date?: string | null;
  investmentId?: number | string | null;
  transactions?: unknown;
}

// Criação de conta usada pelo site e pelo assistente do WhatsApp (que grava com source "whatsapp").
// Quem chama valida os obrigatórios e o mês fechado antes.
export async function createBill(userId: number, input: BillInput, source: Bill["source"] = "manual") {
  const {
    name, amount, month, year, installment, isPaid, dueDay,
    category, notes, barCode, qrCode, type, cardLast4, cardNickname,
    ownership, date, investmentId,
  } = input;

  // Transações (parcelas) opcionais para faturas CARD — usadas pela migração de mês
  // para carregar cada parcela como uma linha real na fatura do próximo mês.
  const rawTransactions =
    type === "CARD" && Array.isArray(input.transactions) ? input.transactions : [];
  const transactions = rawTransactions
    .filter((t: { name?: unknown; amount?: unknown }) => t && t.name)
    .map((t: { name: string; amount: unknown; installment?: unknown; recurring?: unknown; category?: unknown; date?: unknown }) => ({
      name: String(t.name),
      amount: Number.parseFloat(String(t.amount)),
      installment: t.recurring ? null : t.installment ? String(t.installment) : null,
      recurring: !!t.recurring,
      category: t.category ? String(t.category) : null,
      date: t.date ? String(t.date) : null,
    }))
    .filter((t: { amount: number }) => Number.isFinite(t.amount));

  // Quando há transações, o total da fatura é a soma delas (fonte de verdade única).
  const finalAmount = transactions.length
    ? transactions.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0)
    : parseFloat(String(amount));

  const finalCategory = type === "CARD" ? "cartão" : category;
  const finalOwnership: BillOwnership =
    ownership && VALID_OWNERSHIP.includes(ownership) ? ownership : "joint";

  const [bill] = await db.insert(schema.bills).values({
    userId,
    name,
    amount: finalAmount,
    month,
    year,
    installment,
    isPaid: isPaid || false,
    dueDay,
    category: finalCategory,
    ownership: finalOwnership,
    notes,
    barCode,
    qrCode,
    type: type || "NORMAL",
    cardLast4: type === "CARD" ? cardLast4 : null,
    cardNickname: type === "CARD" ? cardNickname : null,
    date: date || null,
    investmentId: investmentId ? Number(investmentId) : null,
    source,
  }).returning();

  if (transactions.length > 0) {
    await db.insert(schema.cardTransactions).values(
      transactions.map((t: { name: string; amount: number; installment: string | null; recurring: boolean; category: string | null; date: string | null }) => ({
        billId: bill.id,
        name: t.name,
        amount: t.amount,
        installment: t.installment,
        recurring: t.recurring,
        category: t.category,
        date: t.date,
      })),
    );
  }

  return bill;
}
