// Cartões planejados: GET ?month&year (uso no mês), POST cria, PATCH edita, DELETE remove.
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCardsUsage } from "@/lib/cards";

const OWNERSHIP = ["mine", "hers", "joint"] as const;

function pick(body: Record<string, unknown>) {
  const patch: Partial<typeof schema.cards.$inferInsert> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (OWNERSHIP.includes(body.ownership as (typeof OWNERSHIP)[number])) patch.ownership = body.ownership as (typeof OWNERSHIP)[number];
  if (body.monthlyLimit !== undefined) patch.monthlyLimit = Number(body.monthlyLimit) || 0;
  if (body.matchTerms !== undefined) patch.matchTerms = String(body.matchTerms);
  if (body.accountId !== undefined) patch.accountId = body.accountId ? Number(body.accountId) : null;
  return patch;
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const month = Number(req.nextUrl.searchParams.get("month"));
  const year = Number(req.nextUrl.searchParams.get("year"));
  if (!month || !year) return NextResponse.json({ error: "month e year são obrigatórios" }, { status: 400 });
  return NextResponse.json(await getCardsUsage(user.id, month, year));
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });
  const [created] = await db
    .insert(schema.cards)
    .values({ userId: user.id, name: String(body.name).trim(), ...pick(body) })
    .returning();
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, ...body } = await req.json();
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  await db
    .update(schema.cards)
    .set({ ...pick(body), updatedAt: new Date().toISOString() })
    .where(and(eq(schema.cards.id, Number(id)), eq(schema.cards.userId, user.id)));
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  await db.delete(schema.cards).where(and(eq(schema.cards.id, id), eq(schema.cards.userId, user.id)));
  return NextResponse.json({ success: true });
}
