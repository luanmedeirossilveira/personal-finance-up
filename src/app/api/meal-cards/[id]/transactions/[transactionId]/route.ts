// src/app/api/meal-cards/[id]/transactions/[transactionId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; transactionId: string } },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const cardId = Number.parseInt(params.id);
  const transactionId = Number.parseInt(params.transactionId);

  const card = await getOwnedCard(cardId, user.id);
  if (!card) return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });

  const transaction = await db.query.mealCardTransactions.findFirst({
    where: and(
      eq(schema.mealCardTransactions.id, transactionId),
      eq(schema.mealCardTransactions.mealCardId, cardId),
    ),
  });
  if (!transaction) return NextResponse.json({ error: "Compra não encontrada" }, { status: 404 });

  try {
    const body = await req.json();
    const allowed: Record<string, unknown> = {};
    for (const f of ["name", "category", "date"]) {
      if (body[f] !== undefined) allowed[f] = body[f];
    }

    // Substitui os itens (produtos) quando enviados
    let savedItems: unknown[] | undefined;
    if (body.items !== undefined) {
      const items = normalizeItems(body.items);
      await db
        .delete(schema.mealCardTransactionItems)
        .where(eq(schema.mealCardTransactionItems.transactionId, transactionId));
      savedItems =
        items.length > 0
          ? await db
              .insert(schema.mealCardTransactionItems)
              .values(items.map((it) => ({ ...it, transactionId })))
              .returning()
          : [];
      // Recalcula o total pela soma dos itens quando o total não veio explícito
      const noAmount = body.amount === undefined || body.amount === null || body.amount === "";
      if (noAmount && items.length > 0) {
        allowed.amount = items.reduce((s, i) => s + i.amount, 0);
      }
    }

    if (body.amount !== undefined && body.amount !== null && body.amount !== "") {
      allowed.amount = Number.parseFloat(body.amount);
    }

    let updated = transaction;
    if (Object.keys(allowed).length > 0) {
      [updated] = await db
        .update(schema.mealCardTransactions)
        .set(allowed)
        .where(eq(schema.mealCardTransactions.id, transactionId))
        .returning();
    }

    // Itens atuais (quando não foram substituídos nesta requisição)
    if (savedItems === undefined) {
      savedItems = await db.query.mealCardTransactionItems.findMany({
        where: eq(schema.mealCardTransactionItems.transactionId, transactionId),
        orderBy: (i, { asc }) => [asc(i.id)],
      });
    }

    return NextResponse.json({ ...updated, items: savedItems });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao atualizar compra" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; transactionId: string } },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const cardId = Number.parseInt(params.id);
  const transactionId = Number.parseInt(params.transactionId);

  const card = await getOwnedCard(cardId, user.id);
  if (!card) return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });

  const transaction = await db.query.mealCardTransactions.findFirst({
    where: and(
      eq(schema.mealCardTransactions.id, transactionId),
      eq(schema.mealCardTransactions.mealCardId, cardId),
    ),
  });
  if (!transaction) return NextResponse.json({ error: "Compra não encontrada" }, { status: 404 });

  await db
    .delete(schema.mealCardTransactions)
    .where(eq(schema.mealCardTransactions.id, transactionId));

  return NextResponse.json({ success: true });
}
