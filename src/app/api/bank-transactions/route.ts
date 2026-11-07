// Transações bancárias: sugestões de conciliação (Hoje), "a categorizar" (Revisão) e créditos (Mês > Entradas).
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { confirmMatch } from "@/lib/reconcile";
import { CLOSED_MONTH_ERROR, isMonthClosed } from "@/lib/month-closing";
import { normalizeCategory } from "@/lib/categories";
import type { BankTransactionStatus } from "@/lib/db/schema";

const STATUSES: BankTransactionStatus[] = ["pending", "suggested", "matched", "categorized", "ignored"];

// GET ?status=pending,suggested&direction=in|out&accounts=cash|credit&limit=50
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const statuses = (sp.get("status") ?? "pending")
    .split(",")
    .filter((s): s is BankTransactionStatus => STATUSES.includes(s as BankTransactionStatus));
  const direction = sp.get("direction");
  const limit = Math.min(Number(sp.get("limit") ?? 50), 200);

  const accounts = await db.query.accounts.findMany({ where: eq(schema.accounts.userId, user.id) });
  const conditions = [eq(schema.bankTransactions.userId, user.id), inArray(schema.bankTransactions.status, statuses)];
  if (direction === "in") conditions.push(gt(schema.bankTransactions.amount, 0));
  if (direction === "out") conditions.push(lt(schema.bankTransactions.amount, 0));
  // cash = conta corrente/poupança/importação; credit = cartões
  const kind = sp.get("accounts");
  if (kind === "credit" || kind === "cash") {
    const ids = accounts.filter((a) => (a.type === "credit") === (kind === "credit")).map((a) => a.id);
    if (ids.length === 0) return NextResponse.json([]);
    conditions.push(inArray(schema.bankTransactions.accountId, ids));
  }

  const rows = await db.query.bankTransactions.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.bankTransactions.date)],
    limit,
  });
  const billIds = rows.map((r) => r.billId).filter((id): id is number => id !== null);
  const bills = billIds.length
    ? await db.query.bills.findMany({ where: inArray(schema.bills.id, billIds) })
    : [];
  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      bill: bills.find((b) => b.id === r.billId) ?? null,
      accountName: accounts.find((a) => a.id === r.accountId)?.name ?? null,
    })),
  );
}

// PATCH { ids, action, category?, month?, year?, billId?, ownership? }
//  confirm      sugestão de conciliação correta → conta paga
//  reject       sugestão errada
//  categorize   só categoriza (Revisão)
//  known        já lançada à mão (não vira custo de novo)
//  ignore       não é gasto (transferência etc.)
//  income       crédito → entrada do mês
//  create_bill  saída → nova conta paga no mês
//  attach_card  compra do cartão → entra na fatura `billId`
export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { ids, action, category, month, year, billId } = await req.json();
  const list: number[] = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean);
  if (list.length === 0) return NextResponse.json({ error: "ids é obrigatório" }, { status: 400 });

  const owned = await db.query.bankTransactions.findMany({
    where: and(eq(schema.bankTransactions.userId, user.id), inArray(schema.bankTransactions.id, list)),
  });
  const ownedIds = owned.map((t) => t.id);
  if (ownedIds.length === 0) return NextResponse.json({ updated: 0 });

  switch (action) {
    case "confirm":
      for (const id of ownedIds) await confirmMatch(user.id, id);
      break;
    case "reject":
      // A sugestão estava errada: tira o vínculo e não tenta casar de novo.
      await db
        .update(schema.bankTransactions)
        .set({ status: "categorized", billId: null })
        .where(inArray(schema.bankTransactions.id, ownedIds));
      break;
    case "categorize":
      await db
        .update(schema.bankTransactions)
        .set({ status: "categorized", ...(category ? { category: String(category) } : {}) })
        .where(inArray(schema.bankTransactions.id, ownedIds));
      break;
    case "known":
      await db
        .update(schema.bankTransactions)
        .set({ status: "categorized" })
        .where(inArray(schema.bankTransactions.id, ownedIds));
      break;
    case "create_bill": {
      if (!month || !year) return NextResponse.json({ error: "month e year são obrigatórios" }, { status: 400 });
      if (await isMonthClosed(user.id, Number(month), Number(year))) return NextResponse.json(CLOSED_MONTH_ERROR, { status: 409 });
      for (const t of owned.filter((t) => t.amount < 0)) {
        const [bill] = await db
          .insert(schema.bills)
          .values({
            userId: user.id,
            name: t.description.trim().toUpperCase().slice(0, 80),
            amount: Math.abs(t.amount),
            month: Number(month),
            year: Number(year),
            isPaid: true,
            date: t.date,
            dueDay: Number(t.date.slice(8, 10)),
            category: category ? normalizeCategory(String(category)) : t.category ? normalizeCategory(t.category) : null,
            ownership: t.ownership,
            type: "NORMAL",
          })
          .returning();
        await db
          .update(schema.bankTransactions)
          .set({ status: "matched", billId: bill.id, category: bill.category })
          .where(eq(schema.bankTransactions.id, t.id));
      }
      break;
    }
    case "attach_card": {
      const target = await db.query.bills.findFirst({
        where: and(eq(schema.bills.id, Number(billId)), eq(schema.bills.userId, user.id), eq(schema.bills.type, "CARD")),
      });
      if (!target) return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 });
      if (await isMonthClosed(user.id, target.month, target.year)) return NextResponse.json(CLOSED_MONTH_ERROR, { status: 409 });
      for (const t of owned.filter((t) => t.amount < 0)) {
        const [ct] = await db
          .insert(schema.cardTransactions)
          .values({
            billId: target.id,
            name: t.description.slice(0, 80),
            amount: Math.abs(t.amount),
            date: t.date,
            category: category ? normalizeCategory(String(category)) : t.category,
          })
          .returning();
        await db
          .update(schema.bankTransactions)
          .set({ status: "categorized", billId: target.id, cardTransactionId: ct.id })
          .where(eq(schema.bankTransactions.id, t.id));
      }
      const all = await db.query.cardTransactions.findMany({ where: eq(schema.cardTransactions.billId, target.id) });
      await db
        .update(schema.bills)
        .set({ amount: all.reduce((s, x) => s + x.amount, 0), updatedAt: new Date().toISOString() })
        .where(eq(schema.bills.id, target.id));
      break;
    }
    case "ignore":
      await db.update(schema.bankTransactions).set({ status: "ignored" }).where(inArray(schema.bankTransactions.id, ownedIds));
      break;
    case "income": {
      // Crédito detectado vira entrada do mês exibido em Mês > Entradas.
      if (!month || !year) return NextResponse.json({ error: "month e year são obrigatórios" }, { status: 400 });
      for (const t of owned.filter((t) => t.amount > 0)) {
        await db.insert(schema.salaries).values({
          userId: user.id,
          person: t.description.slice(0, 60),
          amount: t.amount,
          month: Number(month),
          year: Number(year),
        });
      }
      await db
        .update(schema.bankTransactions)
        .set({ status: "categorized", category: "entrada" })
        .where(inArray(schema.bankTransactions.id, ownedIds));
      break;
    }
    default:
      return NextResponse.json({ error: "ação inválida" }, { status: 400 });
  }
  return NextResponse.json({ updated: ownedIds.length });
}
