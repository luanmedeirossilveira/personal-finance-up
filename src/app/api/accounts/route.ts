// Contas (Pluggy e manuais), investimentos e o número do patrimônio.
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeNetWorth, netWorthHistory } from "@/lib/networth";
import { isPluggyConfigured } from "@/lib/pluggy/client";

const TYPES = ["checking", "savings", "credit", "meal", "investment"] as const;
const OWNERSHIP = ["mine", "hers", "joint"] as const;

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [accounts, investments, items, netWorth, history] = await Promise.all([
    // Inclui as ocultas (archived): a tela separa e permite mostrar de novo.
    db.query.accounts.findMany({ where: eq(schema.accounts.userId, user.id), orderBy: [schema.accounts.createdAt] }),
    db.query.investments.findMany({ where: eq(schema.investments.userId, user.id), orderBy: [schema.investments.createdAt] }),
    db.query.pluggyItems.findMany({ where: eq(schema.pluggyItems.userId, user.id) }),
    computeNetWorth(user.id),
    netWorthHistory(user.id, 120),
  ]);

  return NextResponse.json({ accounts, investments, items, netWorth, history, pluggyConfigured: isPluggyConfigured() });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });

  const [created] = await db
    .insert(schema.accounts)
    .values({
      userId: user.id,
      name: String(body.name),
      type: TYPES.includes(body.type) ? body.type : "checking",
      institution: body.institution || null,
      number: body.number ? String(body.number).slice(-4) : null,
      balance: Number(body.balance) || 0,
      ownership: OWNERSHIP.includes(body.ownership) ? body.ownership : "mine",
      source: "manual",
    })
    .returning();
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, ...body } = await req.json();
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  const patch: Partial<typeof schema.accounts.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.balance !== undefined) patch.balance = Number(body.balance) || 0;
  if (TYPES.includes(body.type)) patch.type = body.type;
  if (OWNERSHIP.includes(body.ownership)) patch.ownership = body.ownership;
  if (body.institution !== undefined) patch.institution = body.institution || null;
  if (body.archived !== undefined) patch.archived = Boolean(body.archived);

  await db.update(schema.accounts).set(patch).where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, user.id)));
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  await db.delete(schema.accounts).where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, user.id)));
  return NextResponse.json({ success: true });
}
