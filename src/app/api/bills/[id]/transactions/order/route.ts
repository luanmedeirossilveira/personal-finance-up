// src/app/api/bills/[id]/transactions/order/route.ts
// Ordem manual das compras da fatura, para conferir na mesma sequência do app do banco.
// `ids` vazio limpa a ordem manual (volta à ordem por data).
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { CLOSED_MONTH_ERROR, isMonthClosed } from "@/lib/month-closing";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const billId = Number.parseInt(params.id);

  const bill = await db.query.bills.findFirst({
    where: and(
      eq(schema.bills.id, billId),
      eq(schema.bills.userId, user.id)
    ),
  });

  if (!bill) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }
  if (await isMonthClosed(user.id, bill.month, bill.year)) {
    return NextResponse.json(CLOSED_MONTH_ERROR, { status: 409 });
  }
  if (bill.type !== "CARD") {
    return NextResponse.json({ error: "Esta conta não é do tipo cartão" }, { status: 400 });
  }

  let ids: unknown;
  try {
    ({ ids } = await req.json());
  } catch {
    return NextResponse.json({ error: "Lista de transações inválida" }, { status: 400 });
  }
  if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id))) {
    return NextResponse.json({ error: "Lista de transações inválida" }, { status: 400 });
  }

  const ct = schema.cardTransactions;

  if (ids.length === 0) {
    await db.update(ct).set({ position: null }).where(eq(ct.billId, billId));
    return NextResponse.json({ success: true });
  }

  // Precisa ser exatamente o conjunto de compras da fatura (sem faltar, sobrar ou repetir).
  const current = await db.query.cardTransactions.findMany({
    where: eq(ct.billId, billId),
    columns: { id: true },
  });
  const currentIds = new Set(current.map((t) => t.id));
  if (ids.length !== currentIds.size || new Set(ids).size !== ids.length || !ids.every((id) => currentIds.has(id))) {
    return NextResponse.json({ error: "Lista de transações inválida" }, { status: 400 });
  }

  const [first, ...rest] = (ids as number[]).map((id, index) =>
    db.update(ct).set({ position: index }).where(and(eq(ct.id, id), eq(ct.billId, billId))),
  );
  await db.batch([first, ...rest]);

  return NextResponse.json({ success: true });
}
