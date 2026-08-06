// src/app/api/bills/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import type { BillOwnership } from "@/lib/db/schema";

const VALID_OWNERSHIP: BillOwnership[] = ["mine", "hers", "joint"];

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const month = parseInt(searchParams.get("month") || "0");
  const year = parseInt(searchParams.get("year") || "0");
  const ownership = searchParams.get("ownership") as BillOwnership | null;

  if (!month || !year) {
    return NextResponse.json({ error: "month e year são obrigatórios" }, { status: 400 });
  }

  const conditions = [
    eq(schema.bills.userId, user.id),
    eq(schema.bills.month, month),
    eq(schema.bills.year, year),
  ];

  // Filtro opcional por ownership (para views individuais)
  if (ownership && VALID_OWNERSHIP.includes(ownership)) {
    conditions.push(eq(schema.bills.ownership, ownership));
  }

  const bills = await db.query.bills.findMany({
    where: and(...conditions),
    orderBy: (bills, { asc }) => [asc(bills.name)],
  });

  return NextResponse.json(bills);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      name, amount, month, year, installment, isPaid, dueDay,
      category, notes, barCode, qrCode, type, cardLast4, cardNickname,
      ownership,
    } = body;

    if (!name || amount === undefined || !month || !year) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    // Transações (parcelas) opcionais para faturas CARD — usadas pela migração de mês
    // para carregar cada parcela como uma linha real na fatura do próximo mês.
    const rawTransactions =
      type === "CARD" && Array.isArray(body.transactions) ? body.transactions : [];
    const transactions = rawTransactions
      .filter((t: { name?: unknown; amount?: unknown }) => t && t.name)
      .map((t: { name: string; amount: unknown; installment?: unknown; category?: unknown; date?: unknown }) => ({
        name: String(t.name),
        amount: Number.parseFloat(String(t.amount)),
        installment: t.installment ? String(t.installment) : null,
        category: t.category ? String(t.category) : null,
        date: t.date ? String(t.date) : null,
      }))
      .filter((t: { amount: number }) => Number.isFinite(t.amount));

    // Quando há transações, o total da fatura é a soma delas (fonte de verdade única).
    const finalAmount = transactions.length
      ? transactions.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0)
      : parseFloat(amount);

    const finalCategory = type === "CARD" ? "cartão" : category;
    const finalOwnership: BillOwnership =
      ownership && VALID_OWNERSHIP.includes(ownership) ? ownership : "joint";

    const [bill] = await db.insert(schema.bills).values({
      userId: user.id,
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
    }).returning();

    if (transactions.length > 0) {
      await db.insert(schema.cardTransactions).values(
        transactions.map((t: { name: string; amount: number; installment: string | null; category: string | null; date: string | null }) => ({
          billId: bill.id,
          name: t.name,
          amount: t.amount,
          installment: t.installment,
          category: t.category,
          date: t.date,
        })),
      );
    }

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar conta" }, { status: 500 });
  }
}