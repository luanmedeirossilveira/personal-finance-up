import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const all = searchParams.get("all") === "1";

  const items = await db.query.futureBills.findMany({
    where: and(eq(schema.futureBills.userId, user.id)),
    orderBy: [schema.futureBills.createdAt],
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const payload = await req.json();
  const [inserted] = await db.insert(schema.futureBills).values({
    userId: user.id,
    name: payload.name,
    amount: payload.amount || null,
    reminderDate: payload.reminderDate || null,
    notifyDaysBefore: payload.notifyDaysBefore || 3,
    notes: payload.notes || null,
    priority: payload.priority || null,
  }).returning();

  return NextResponse.json(inserted, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, ...patch } = await req.json();
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  await db.update(schema.futureBills).set(patch).where(and(eq(schema.futureBills.id, id), eq(schema.futureBills.userId, user.id)));
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = req.nextUrl;
  const id = parseInt(searchParams.get("id") || "0");
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  await db.delete(schema.futureBills).where(and(eq(schema.futureBills.id, id), eq(schema.futureBills.userId, user.id)));
  return NextResponse.json({ success: true });
}
