import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const year = parseInt(req.nextUrl.searchParams.get("year") || new Date().getFullYear().toString());

  const bills = await db.query.bills.findMany({
    where: and(
      eq(schema.bills.userId, user.id),
      eq(schema.bills.year, year)
    ),
  });

  const salaries = await db.query.salaries.findMany({
    where: and(
      eq(schema.salaries.userId, user.id),
      eq(schema.salaries.year, year)
    ),
  });

  // Aggregate by month
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthBills = bills.filter((b) => b.month === month);
    const monthSalaries = salaries.filter((s) => s.month === month);

    const totalBills = monthBills.reduce((sum, b) => sum + b.amount, 0);
    const paidBills = monthBills.filter((b) => b.isPaid).reduce((sum, b) => sum + b.amount, 0);
    const pendingBills = monthBills.filter((b) => !b.isPaid).reduce((sum, b) => sum + b.amount, 0);
    const totalIncome = monthSalaries.reduce((sum, s) => sum + s.amount, 0);

    return {
      month,
      totalBills,
      paidBills,
      pendingBills,
      totalIncome,
      balance: totalIncome - totalBills,
      billCount: monthBills.length,
      paidCount: monthBills.filter((b) => b.isPaid).length,
    };
  });

  return NextResponse.json({ months, year });
}
