import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET /api/history-debts?debtId=X
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const debtId = Number(req.nextUrl.searchParams.get("debtId") || "0");
  if (!debtId) return NextResponse.json({ error: "debtId é obrigatório" }, { status: 400 });

  const items = await db.query.historyDebts.findMany({
    where: and(
      eq(schema.historyDebts.userId, user.id),
      eq(schema.historyDebts.debtId, debtId)
    ),
    orderBy: [schema.historyDebts.changedAt],
  });

  const links = await db.query.debtBillLinks.findMany({
    where: and(
      eq(schema.debtBillLinks.userId, user.id),
      eq(schema.debtBillLinks.debtId, debtId)
    ),
    with: { bill: true },
  });

  const billsByHistoryId = new Map<number, Array<(typeof links)[number]["bill"]>>();
  for (const link of links) {
    if (link.historyDebtId) {
      const current = billsByHistoryId.get(link.historyDebtId) ?? [];
      current.push(link.bill);
      billsByHistoryId.set(link.historyDebtId, current);
    }
  }

  return NextResponse.json(
    items.map((item) => {
      const linkedBills = (billsByHistoryId.get(item.id) ?? []).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      return {
        ...item,
        linkedBill: linkedBills[0] ?? null,
        linkedBills,
      };
    })
  );
}

// POST /api/history-debts
// Cria uma renegociação e opcionalmente gera uma nova bill já vinculada ao histórico
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const debtId = Number(body.debtId || 0);
  const newAmount = Number(body.newAmount);
  const reason = body.reason ? String(body.reason) : null;
  const createBill = Boolean(body.createBill);

  if (!debtId || Number.isNaN(newAmount)) {
    return NextResponse.json({ error: "debtId e newAmount são obrigatórios" }, { status: 400 });
  }

  const debt = await db.query.debts.findFirst({
    where: and(eq(schema.debts.id, debtId), eq(schema.debts.userId, user.id)),
  });
  if (!debt) return NextResponse.json({ error: "Dívida não encontrada" }, { status: 404 });

  const month = Number(body.billMonth || 0);
  const year = Number(body.billYear || 0);
  const billAmount = Number(body.billAmount);
  const billName = String(body.billName || debt.name || "Pagamento de dívida").trim();
  const billNotes = body.billNotes ? String(body.billNotes) : null;
  const paymentType = body.billPaymentType === "PARCELADA" ? "PARCELADA" : "AVISTA";
  const installments = Number(body.billInstallments || 0);
  const installmentLabel = paymentType === "PARCELADA" ? `1/${Math.max(2, installments)}` : "ÚNICO";

  if (createBill && (!month || !year || Number.isNaN(billAmount) || !billName)) {
    return NextResponse.json(
      { error: "Para criar a conta, informe billName, billAmount, billMonth e billYear" },
      { status: 400 }
    );
  }

  if (createBill && paymentType === "PARCELADA" && (!Number.isInteger(installments) || installments < 2)) {
    return NextResponse.json(
      { error: "Para conta parcelada, informe billInstallments com valor minimo 2" },
      { status: 400 }
    );
  }

  const [history] = await db
    .insert(schema.historyDebts)
    .values({
      userId: user.id,
      debtId,
      previousAmount: debt.amount ?? 0,
      newAmount,
      reason: reason || "Renegociação manual",
    })
    .returning();

  await db
    .update(schema.debts)
    .set({ amount: newAmount, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.debts.id, debtId), eq(schema.debts.userId, user.id)));

  if (!createBill) {
    return NextResponse.json({ history }, { status: 201 });
  }

  if (paymentType === "PARCELADA") {
    const totalInstallments = Math.max(2, installments);
    const fixedInstallmentAmount = Number((billAmount / totalInstallments).toFixed(2));
    const billsToInsert: Array<typeof schema.bills.$inferInsert> = [];

    for (let i = 0; i < totalInstallments; i++) {
      const monthOffset = month - 1 + i;
      const billMonth = (monthOffset % 12) + 1;
      const billYear = year + Math.floor(monthOffset / 12);
      const amount =
        i === totalInstallments - 1
          ? Number((billAmount - fixedInstallmentAmount * (totalInstallments - 1)).toFixed(2))
          : fixedInstallmentAmount;

      billsToInsert.push({
        userId: user.id,
        name: billName,
        amount,
        month: billMonth,
        year: billYear,
        installment: `${i + 1}/${totalInstallments}`,
        notes: billNotes,
        category: "outros",
        type: "NORMAL",
        isPaid: false,
      });
    }

    const createdBills = await db.insert(schema.bills).values(billsToInsert).returning();
    const links = await db
      .insert(schema.debtBillLinks)
      .values(
        createdBills.map((bill) => ({
          userId: user.id,
          debtId,
          billId: bill.id,
          historyDebtId: history.id,
        }))
      )
      .returning();

    return NextResponse.json({ history, bills: createdBills, links }, { status: 201 });
  }

  const [bill] = await db
    .insert(schema.bills)
    .values({
      userId: user.id,
      name: billName,
      amount: billAmount,
      month,
      year,
      installment: installmentLabel,
      notes: billNotes,
      category: "outros",
      type: "NORMAL",
      isPaid: false,
    })
    .returning();

  const [link] = await db
    .insert(schema.debtBillLinks)
    .values({
      userId: user.id,
      debtId,
      billId: bill.id,
      historyDebtId: history.id,
    })
    .returning();

  return NextResponse.json({ history, bills: [bill], links: [link] }, { status: 201 });
}