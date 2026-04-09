import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

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

  const billId = parseInt(params.id);

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
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  return NextResponse.json(transactions);
}

export async function POST(
  req: NextRequest, 
  { params }: { params: { id: string } }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const billId = parseInt(params.id);

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

    if (!name || amount === undefined) {
      return NextResponse.json({ error: "name e amount são obrigatórios" }, { status: 400 });
    }

    const [transaction] = await db.insert(schema.cardTransactions).values({
      billId,
      name,
      amount: parseFloat(amount),
      installment: installment || null,
      category: category || null,
      date: date || null,
    }).returning();

    // Recalcular total da bill
    await recalculateBillTotal(billId);

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar transação" }, { status: 500 });
  }
}
