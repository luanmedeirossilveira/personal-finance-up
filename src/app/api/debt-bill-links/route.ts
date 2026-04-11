import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET /api/debt-bill-links?debtId=X — lista bills disponíveis para vincular (do mês/ano)
// e já retorna quais estão vinculadas
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const debtId = Number(searchParams.get("debtId") || "0");
  const month = Number(searchParams.get("month") || "0");
  const year = Number(searchParams.get("year") || "0");

  if (!debtId || !month || !year)
    return NextResponse.json({ error: "debtId, month e year são obrigatórios" }, { status: 400 });

  // Bills do mês/ano do usuário
  const bills = await db.query.bills.findMany({
    where: and(
      eq(schema.bills.userId, user.id),
      eq(schema.bills.month, month),
      eq(schema.bills.year, year)
    ),
    orderBy: [schema.bills.name],
  });

  // Links já existentes para essa dívida
  const links = await db.query.debtBillLinks.findMany({
    where: and(
      eq(schema.debtBillLinks.userId, user.id),
      eq(schema.debtBillLinks.debtId, debtId)
    ),
  });

  const linkedBillIds = new Set(links.map((l) => l.billId));

  return NextResponse.json(
    bills.map((b) => ({ ...b, linked: linkedBillIds.has(b.id), linkId: links.find((l) => l.billId === b.id)?.id }))
  );
}

// POST /api/debt-bill-links — vincula uma bill à dívida
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { debtId, billId, historyDebtId } = await req.json();
  if (!debtId || !billId)
    return NextResponse.json({ error: "debtId e billId são obrigatórios" }, { status: 400 });

  // Verifica se já existe
  const existing = await db.query.debtBillLinks.findFirst({
    where: and(
      eq(schema.debtBillLinks.debtId, debtId),
      eq(schema.debtBillLinks.billId, billId)
    ),
  });
  if (existing) return NextResponse.json(existing); // idempotente

  const [inserted] = await db
    .insert(schema.debtBillLinks)
    .values({ userId: user.id, debtId, billId, historyDebtId: historyDebtId || null })
    .returning();

  return NextResponse.json(inserted, { status: 201 });
}

// DELETE /api/debt-bill-links?id=X — remove vínculo
export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id") || "0");
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  await db
    .delete(schema.debtBillLinks)
    .where(and(eq(schema.debtBillLinks.id, id), eq(schema.debtBillLinks.userId, user.id)));

  return NextResponse.json({ success: true });
}