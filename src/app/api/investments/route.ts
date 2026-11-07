// Investimentos manuais (fallback quando o conector não traz posições) e edição de saldo na Revisão.
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { INVESTMENT_TYPES } from "@/lib/db/schema";

function pick(body: Record<string, unknown>) {
  const patch: Partial<typeof schema.investments.$inferInsert> = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (INVESTMENT_TYPES.includes(body.type as (typeof INVESTMENT_TYPES)[number])) patch.type = String(body.type);
  if (body.appliedAmount !== undefined) patch.appliedAmount = Number(body.appliedAmount) || 0;
  if (body.balance !== undefined) patch.balance = Number(body.balance) || 0;
  if (body.dueDate !== undefined) patch.dueDate = body.dueDate ? String(body.dueDate) : null;
  if (body.accountId !== undefined) patch.accountId = body.accountId ? Number(body.accountId) : null;
  return patch;
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });
  const [created] = await db
    .insert(schema.investments)
    .values({ userId: user.id, name: String(body.name), source: "manual", ...pick(body) })
    .returning();
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, ...body } = await req.json();
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  await db
    .update(schema.investments)
    .set({ ...pick(body), updatedAt: new Date().toISOString() })
    .where(and(eq(schema.investments.id, id), eq(schema.investments.userId, user.id)));
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  await db.delete(schema.investments).where(and(eq(schema.investments.id, id), eq(schema.investments.userId, user.id)));
  return NextResponse.json({ success: true });
}
