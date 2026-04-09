import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = parseInt(params.id);
  const body = await req.json();

  // Only allow specific fields to be updated to avoid accidental writes
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
    "notes",
    "barCode",
    "qrCode",
    "type",
    "cardLast4",
    "cardNickname",
  ];
  for (const f of fields) {
    if (body[f] !== undefined) allowed[f] = body[f];
  }
  allowed.updatedAt = new Date().toISOString();

  const [updated] = await db
    .update(schema.bills)
    .set(allowed)
    .where(and(eq(schema.bills.id, id), eq(schema.bills.userId, user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = parseInt(params.id);

  await db
    .delete(schema.bills)
    .where(and(eq(schema.bills.id, id), eq(schema.bills.userId, user.id)));

  return NextResponse.json({ success: true });
}
