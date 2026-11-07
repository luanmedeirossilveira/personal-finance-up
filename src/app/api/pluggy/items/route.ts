// Registra uma conexão do MeuPluggy pelo itemId (gerado ao autorizar o banco no portal da Pluggy).
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getItem, isPluggyConfigured } from "@/lib/pluggy/client";
import { syncUser } from "@/lib/pluggy/sync";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!isPluggyConfigured()) return NextResponse.json({ error: "Pluggy não configurado no servidor" }, { status: 503 });

  const { itemId } = await req.json();
  const id = String(itemId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "itemId inválido" }, { status: 400 });

  try {
    const item = await getItem(id);
    await db
      .insert(schema.pluggyItems)
      .values({ userId: user.id, itemId: id, connectorName: item.connector?.name ?? null, status: item.status })
      .onConflictDoNothing();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const result = await syncUser(user.id);
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  // As contas sincronizadas ficam (viram histórico); só a conexão sai.
  await db.delete(schema.pluggyItems).where(and(eq(schema.pluggyItems.id, id), eq(schema.pluggyItems.userId, user.id)));
  return NextResponse.json({ success: true });
}
