// src/app/api/bills/[id]/transactions/route.ts
// Extrato de compras de uma bill do tipo CARD. Cada compra pode ter itens (produtos).
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { normalizeItems } from "@/lib/items";

// Recalcula o total da bill baseado nas transações
async function recalculateBillTotal(billId: number) {
  const transactions = await db.query.cardTransactions.findMany({
    where: eq(schema.cardTransactions.billId, billId),
  });

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  await db
    .update(schema.bills)
    .set({ amount: total, updatedAt: new Date().toISOString() })
    .where(eq(schema.bills.id, billId));

  return total;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const billId = Number.parseInt(params.id);

  // Verificar se a bill pertence ao usuário e é do tipo CARD
  const bill = await db.query.bills.findFirst({
    where: and(
      eq(schema.bills.id, billId),
      eq(schema.bills.userId, user.id)
    ),
  });

  if (!bill) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  if (bill.type !== "CARD") {
    return NextResponse.json({ error: "Esta conta não é do tipo cartão" }, { status: 400 });
  }

  const transactions = await db.query.cardTransactions.findMany({
    where: eq(schema.cardTransactions.billId, billId),
    orderBy: (t, { desc }) => [desc(t.date), desc(t.id)],
  });

  // Anexa os itens (produtos) de cada compra
  const txIds = transactions.map((t) => t.id);
  const itemsByTx: Record<number, unknown[]> = {};
  if (txIds.length > 0) {
    const allItems = await db.query.cardTransactionItems.findMany({
      where: inArray(schema.cardTransactionItems.transactionId, txIds),
      orderBy: (i, { asc }) => [asc(i.id)],
    });
    for (const it of allItems) {
      (itemsByTx[it.transactionId] ||= []).push(it);
    }
  }

  return NextResponse.json(
    transactions.map((t) => ({ ...t, items: itemsByTx[t.id] || [] })),
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const billId = Number.parseInt(params.id);

  // Verificar se a bill pertence ao usuário e é do tipo CARD
  const bill = await db.query.bills.findFirst({
    where: and(
      eq(schema.bills.id, billId),
      eq(schema.bills.userId, user.id)
    ),
  });

  if (!bill) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  if (bill.type !== "CARD") {
    return NextResponse.json({ error: "Esta conta não é do tipo cartão" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { name, amount, installment, category, date } = body;
    const items = normalizeItems(body.items);
    const itemsSum = items.reduce((s, i) => s + i.amount, 0);

    const hasAmount = amount !== undefined && amount !== null && amount !== "";
    const finalAmount = hasAmount ? Number.parseFloat(amount) : items.length ? itemsSum : NaN;

    if (!name || !Number.isFinite(finalAmount)) {
      return NextResponse.json(
        { error: "name e amount (ou itens) são obrigatórios" },
        { status: 400 },
      );
    }

    const [transaction] = await db.insert(schema.cardTransactions).values({
      billId,
      name,
      amount: finalAmount,
      installment: installment || null,
      category: category || null,
      date: date || null,
    }).returning();

    let savedItems: unknown[] = [];
    if (items.length > 0) {
      savedItems = await db.insert(schema.cardTransactionItems).values(
        items.map((it) => ({ ...it, transactionId: transaction.id })),
      ).returning();
    }

    // Recalcular total da bill
    await recalculateBillTotal(billId);

    return NextResponse.json({ ...transaction, items: savedItems }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar transação" }, { status: 500 });
  }
}
