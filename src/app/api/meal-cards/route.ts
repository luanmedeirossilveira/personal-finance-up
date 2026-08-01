// src/app/api/meal-cards/route.ts
// Cartões de alimentação — controle mensal isolado (não afeta renda/contas).
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const month = parseInt(searchParams.get("month") || "0");
  const year = parseInt(searchParams.get("year") || "0");

  if (!month || !year) {
    return NextResponse.json({ error: "month e year são obrigatórios" }, { status: 400 });
  }

  const cards = await db.query.mealCards.findMany({
    where: and(
      eq(schema.mealCards.userId, user.id),
      eq(schema.mealCards.month, month),
      eq(schema.mealCards.year, year),
    ),
    orderBy: (c, { asc }) => [asc(c.name)],
  });

  // Anexa o total gasto (soma do extrato) em cada cartão, para exibir o disponível
  // sem precisar expandir. O limite é fixo; o "spent" é derivado das transações.
  const spentByCard: Record<number, number> = {};
  const cardIds = cards.map((c) => c.id);
  if (cardIds.length > 0) {
    const txs = await db.query.mealCardTransactions.findMany({
      where: inArray(schema.mealCardTransactions.mealCardId, cardIds),
    });
    for (const t of txs) {
      spentByCard[t.mealCardId] = (spentByCard[t.mealCardId] || 0) + t.amount;
    }
  }

  return NextResponse.json(cards.map((c) => ({ ...c, spent: spentByCard[c.id] || 0 })));
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, limitAmount, color, month, year } = body;

    if (!name || !month || !year) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const [card] = await db.insert(schema.mealCards).values({
      userId: user.id,
      name: String(name).trim(),
      limitAmount: limitAmount !== undefined ? parseFloat(limitAmount) : 0,
      color: color || "#5ab28d",
      month,
      year,
    }).returning();

    return NextResponse.json({ ...card, spent: 0 }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar cartão" }, { status: 500 });
  }
}
