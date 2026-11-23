// src/app/api/bills/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { CLOSED_MONTH_ERROR, isMonthClosed } from "@/lib/month-closing";
import { VALID_OWNERSHIP, createBill } from "@/lib/bills";
import type { BillOwnership } from "@/lib/db/schema";

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
    const { name, amount, month, year } = body;

    if (!name || amount === undefined || !month || !year) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }
    if (await isMonthClosed(user.id, Number(month), Number(year))) {
      return NextResponse.json(CLOSED_MONTH_ERROR, { status: 409 });
    }

    const bill = await createBill(user.id, body);

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar conta" }, { status: 500 });
  }
}