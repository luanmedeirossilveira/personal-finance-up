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

  const bills = await db.query.bills.findMany({
    where: and(
      eq(schema.bills.userId, user.id),
      eq(schema.bills.month, month),
      eq(schema.bills.year, year)
    ),
    orderBy: (bills, { asc }) => [asc(bills.name)],
  });

  return NextResponse.json(bills);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, amount, month, year, installment, isPaid, dueDay, category, notes } = body;

    if (!name || amount === undefined || !month || !year) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const [bill] = await db.insert(schema.bills).values({
      userId: user.id,
      name,
      amount: parseFloat(amount),
      month,
      year,
      installment,
      isPaid: isPaid || false,
      dueDay,
      category,
      notes,
    }).returning();

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar conta" }, { status: 500 });
  }
}
