import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; transactionId: string } }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const billId = parseInt(params.id);
  const transactionId = parseInt(params.transactionId);

  // Verificar se a bill pertence ao usuário
  const bill = await db.query.bills.findFirst({
    where: and(
      eq(schema.bills.id, billId),
      eq(schema.bills.userId, user.id)
    ),
  });

  if (!bill) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  // Verificar se a transação pertence à bill
  const transaction = await db.query.cardTransactions.findFirst({
    where: and(
      eq(schema.cardTransactions.id, transactionId),
      eq(schema.cardTransactions.billId, billId)
    ),
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
  }

  try {
    const body = await req.json();

    // Only allow specific fields to be updated
    const allowed: any = {};
    const fields = ["name", "installment", "category", "date"];
    for (const f of fields) {
      if (body[f] !== undefined) {
        allowed[f] = body[f];
      }
    }

    // Substitui os itens (produtos) quando enviados
    let savedItems: unknown[] | undefined;
    if (body.items !== undefined) {
      const items = normalizeItems(body.items);
      await db
        .delete(schema.cardTransactionItems)
        .where(eq(schema.cardTransactionItems.transactionId, transactionId));
      savedItems =
        items.length > 0
          ? await db
              .insert(schema.cardTransactionItems)
              .values(items.map((it) => ({ ...it, transactionId })))
              .returning()
          : [];
      // Recalcula o valor pela soma dos itens quando o total não veio explícito
      const noAmount = body.amount === undefined || body.amount === null || body.amount === "";
      if (noAmount && items.length > 0) {
        allowed.amount = items.reduce((s, i) => s + i.amount, 0);
      }
    }

    if (body.amount !== undefined && body.amount !== null && body.amount !== "") {
      allowed.amount = parseFloat(body.amount);
    }

    let updated = transaction;
    if (Object.keys(allowed).length > 0) {
      [updated] = await db
        .update(schema.cardTransactions)
        .set(allowed)
        .where(eq(schema.cardTransactions.id, transactionId))
        .returning();
    }

    // Itens atuais (quando não foram substituídos nesta requisição)
    if (savedItems === undefined) {
      savedItems = await db.query.cardTransactionItems.findMany({
        where: eq(schema.cardTransactionItems.transactionId, transactionId),
        orderBy: (i, { asc }) => [asc(i.id)],
      });
    }

    // Recalcular total da bill
    await recalculateBillTotal(billId);

    return NextResponse.json({ ...updated, items: savedItems });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao atualizar transação" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; transactionId: string } }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const billId = parseInt(params.id);
  const transactionId = parseInt(params.transactionId);

  // Verificar se a bill pertence ao usuário
  const bill = await db.query.bills.findFirst({
    where: and(
      eq(schema.bills.id, billId),
      eq(schema.bills.userId, user.id)
    ),
  });

  if (!bill) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  // Verificar se a transação pertence à bill
  const transaction = await db.query.cardTransactions.findFirst({
    where: and(
      eq(schema.cardTransactions.id, transactionId),
      eq(schema.cardTransactions.billId, billId)
    ),
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
  }

  await db
    .delete(schema.cardTransactions)
    .where(eq(schema.cardTransactions.id, transactionId));

  // Recalcular total da bill
  const newTotal = await recalculateBillTotal(billId);

  return NextResponse.json({ success: true, newTotal });
}
