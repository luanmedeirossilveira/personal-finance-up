// src/app/api/meal-cards/[id]/transactions/route.ts
// Extrato de compras de um cartão de alimentação. Cada compra pode ter itens (produtos).
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { normalizeItems } from "@/lib/meal-cards/items";

async function getOwnedCard(cardId: number, userId: number) {
  return db.query.mealCards.findFirst({
    where: and(
      eq(schema.mealCards.id, cardId),
      eq(schema.mealCards.userId, userId),
    ),
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const cardId = Number.parseInt(params.id);
  const card = await getOwnedCard(cardId, user.id);
  if (!card) return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });

  const transactions = await db.query.mealCardTransactions.findMany({
    where: eq(schema.mealCardTransactions.mealCardId, cardId),
    orderBy: (t, { desc }) => [desc(t.date), desc(t.id)],
  });

  // Anexa os itens (produtos) de cada compra
  const txIds = transactions.map((t) => t.id);
  const itemsByTx: Record<number, unknown[]> = {};
  if (txIds.length > 0) {
    const allItems = await db.query.mealCardTransactionItems.findMany({
      where: inArray(schema.mealCardTransactionItems.transactionId, txIds),
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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const cardId = Number.parseInt(params.id);
  const card = await getOwnedCard(cardId, user.id);
  if (!card) return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });

  try {
    const body = await req.json();
    const { name, amount, category, date } = body;
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

    const [transaction] = await db.insert(schema.mealCardTransactions).values({
      mealCardId: cardId,
      name: String(name).trim(),
      amount: finalAmount,
      category: category || null,
      date: date || null,
    }).returning();

    let savedItems: unknown[] = [];
    if (items.length > 0) {
      savedItems = await db.insert(schema.mealCardTransactionItems).values(
        items.map((it) => ({ ...it, transactionId: transaction.id })),
      ).returning();
    }

    return NextResponse.json({ ...transaction, items: savedItems }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar compra" }, { status: 500 });
  }
}
