// src/app/api/bills/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { CLOSED_MONTH_ERROR, isMonthClosed } from "@/lib/month-closing";
import { applyPaidSideEffects } from "@/lib/bills";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = Number.parseInt(params.id);
  const body = await req.json();

  const allowed: any = {};
  const fields = [
    "name",
    "amount",
    "month",
    "year",
    "installment",
    "isPaid",
    "dueDay",
    "category",
    "ownership", // v2: Governança do casal
    "notes",
    "barCode",
    "qrCode",
    "type",
    "cardLast4",
    "cardNickname",
    "date",
    "investmentId", // v3: aporte vinculado a um investimento
  ];
  for (const f of fields) {
    if (body[f] !== undefined) allowed[f] = body[f];
  }
  allowed.updatedAt = new Date().toISOString();

  const before = await db.query.bills.findFirst({
    where: and(eq(schema.bills.id, id), eq(schema.bills.userId, user.id)),
  });
  if (!before) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  const target = { month: allowed.month ?? before.month, year: allowed.year ?? before.year };
  if ((await isMonthClosed(user.id, before.month, before.year)) || (await isMonthClosed(user.id, target.month, target.year))) {
    return NextResponse.json(CLOSED_MONTH_ERROR, { status: 409 });
  }

  const [updated] = await db
    .update(schema.bills)
    .set(allowed)
    .where(and(eq(schema.bills.id, id), eq(schema.bills.userId, user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  await applyPaidSideEffects(user.id, before, updated);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = Number.parseInt(params.id);

  const bill = await db.query.bills.findFirst({
    where: and(eq(schema.bills.id, id), eq(schema.bills.userId, user.id)),
  });
  if (bill && (await isMonthClosed(user.id, bill.month, bill.year))) {
    return NextResponse.json(CLOSED_MONTH_ERROR, { status: 409 });
  }

  await db
    .delete(schema.bills)
    .where(and(eq(schema.bills.id, id), eq(schema.bills.userId, user.id)));

  return NextResponse.json({ success: true });
}