// src/app/api/meal-cards/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = Number.parseInt(params.id);
  const body = await req.json();

  const allowed: Record<string, unknown> = {};
  if (body.name !== undefined) allowed.name = String(body.name).trim();
  if (body.limitAmount !== undefined) allowed.limitAmount = parseFloat(body.limitAmount);
  if (body.color !== undefined) allowed.color = body.color;
  allowed.updatedAt = new Date().toISOString();

  const [updated] = await db
    .update(schema.mealCards)
    .set(allowed)
    .where(and(eq(schema.mealCards.id, id), eq(schema.mealCards.userId, user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = Number.parseInt(params.id);

  await db
    .delete(schema.mealCards)
    .where(and(eq(schema.mealCards.id, id), eq(schema.mealCards.userId, user.id)));

  return NextResponse.json({ success: true });
}
