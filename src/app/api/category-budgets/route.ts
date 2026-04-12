// src/app/api/category-budgets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
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

  const budgets = await db.query.categoryBudgets.findMany({
    where: and(
      eq(schema.categoryBudgets.userId, user.id),
      eq(schema.categoryBudgets.month, month),
      eq(schema.categoryBudgets.year, year),
    ),
  });

  return NextResponse.json(budgets);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { category, amount, month, year } = body;

    if (!category || amount === undefined || !month || !year) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    // Upsert: atualiza se já existe limite para essa categoria/mês/ano
    const existing = await db.query.categoryBudgets.findFirst({
      where: and(
        eq(schema.categoryBudgets.userId, user.id),
        eq(schema.categoryBudgets.category, category),
        eq(schema.categoryBudgets.month, month),
        eq(schema.categoryBudgets.year, year),
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(schema.categoryBudgets)
        .set({ amount: parseFloat(amount), updatedAt: new Date().toISOString() })
        .where(eq(schema.categoryBudgets.id, existing.id))
        .returning();
      return NextResponse.json(updated);
    }

    const [budget] = await db
      .insert(schema.categoryBudgets)
      .values({
        userId: user.id,
        category,
        amount: parseFloat(amount),
        month,
        year,
      })
      .returning();

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao salvar limite" }, { status: 500 });
  }
}