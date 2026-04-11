import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET /api/debts?month=6&year=2025
// Retorna dívidas enriquecidas com paidPartial (mês atual) e linkedBills
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const month = Number(searchParams.get("month")) || null;
  const year = Number(searchParams.get("year")) || null;

  const debts = await db.query.debts.findMany({
    where: eq(schema.debts.userId, user.id),
    orderBy: [schema.debts.createdAt],
  });

  const result = await Promise.all(
    debts.map(async (debt) => {
      const links = await db.query.debtBillLinks.findMany({
        where: and(
          eq(schema.debtBillLinks.debtId, debt.id),
          eq(schema.debtBillLinks.userId, user.id)
        ),
        with: { bill: true },
      }) as Array<{ bill: { month: number; year: number; amount?: number }, id: number }>;

      // paidPartial = soma das bills vinculadas no mês/ano selecionado
      const paidPartial =
        month && year
          ? links
            .filter((l) => l.bill.month === month && l.bill.year === year)
            .reduce((acc, l) => acc + (l.bill.amount ?? 0), 0)
          : 0;

      // paidAmount = soma de todas as bills vinculadas (histórico total)
      const paidAmount = links.reduce((acc, l) => acc + (l.bill.amount ?? 0), 0);

      return {
        ...debt,
        paidAmount,
        paidPartial,
        linkedBills: links.map((l) => ({ ...l.bill, linkId: l.id })),
      };
    })
  );

  return NextResponse.json(result);
}

// POST /api/debts
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { name, amount, notes } = await req.json();
  if (!name || amount == null)
    return NextResponse.json({ error: "name e amount são obrigatórios" }, { status: 400 });

  const [inserted] = await db
    .insert(schema.debts)
    .values({ userId: user.id, name, amount, notes: notes || null })
    .returning();

  // Registra criação no histórico
  await db.insert(schema.historyDebts).values({
    userId: user.id,
    debtId: inserted.id,
    previousAmount: 0,
    newAmount: amount,
    reason: "Dívida criada",
  });

  return NextResponse.json(inserted, { status: 201 });
}

// PATCH /api/debts — editar nome/notes/isPaid; se amount mudar → registra renegociação
export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id, amount, reason, ...rest } = await req.json();
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  if (amount != null) {
    const current = await db.query.debts.findFirst({
      where: and(eq(schema.debts.id, id), eq(schema.debts.userId, user.id)),
    });
    if (current && current.amount !== amount) {
      await db.insert(schema.historyDebts).values({
        userId: user.id,
        debtId: id,
        previousAmount: current.amount ?? 0,
        newAmount: amount,
        reason: reason || "Renegociação",
      });
    }
  }

  await db
    .update(schema.debts)
    .set({ ...(amount != null && { amount }), ...rest, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.debts.id, id), eq(schema.debts.userId, user.id)));

  return NextResponse.json({ success: true });
}

// DELETE /api/debts?id=X
export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id") || "0");
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  await db
    .delete(schema.debts)
    .where(and(eq(schema.debts.id, id), eq(schema.debts.userId, user.id)));

  return NextResponse.json({ success: true });
}