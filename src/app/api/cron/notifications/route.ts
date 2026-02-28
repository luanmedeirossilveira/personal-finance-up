import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { sendDueSoonAlert, sendMonthlyOverview, sendFutureBillReminder } from "@/lib/email";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// This route is called by Vercel Cron
// Configure in vercel.json: { "crons": [{"path": "/api/cron/notifications", "schedule": "0 8 * * *"}] }

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const adminUser = await db.query.users.findFirst();
  if (!adminUser) return NextResponse.json({ ok: true });

  // Get bills for current month
  const bills = await db.query.bills.findMany({
    where: and(
      eq(schema.bills.userId, adminUser.id),
      eq(schema.bills.month, month),
      eq(schema.bills.year, year)
    ),
  });

  // Monthly overview on day 1
  if (day === 1) {
    const unpaidBills = bills.filter((b) => !b.isPaid);
    const paidBills = bills.filter((b) => b.isPaid);
    const salaries = await db.query.salaries.findMany({
      where: and(
        eq(schema.salaries.userId, adminUser.id),
        eq(schema.salaries.month, month),
        eq(schema.salaries.year, year)
      ),
    });

    const totalBills = bills.reduce((s, b) => s + b.amount, 0);
    const totalPaid = paidBills.reduce((s, b) => s + b.amount, 0);
    const totalPending = unpaidBills.reduce((s, b) => s + b.amount, 0);
    const totalIncome = salaries.reduce((s, sal) => s + sal.amount, 0);

    const upcomingDue = unpaidBills
      .filter((b) => b.dueDay)
      .sort((a, b) => (a.dueDay || 0) - (b.dueDay || 0))
      .slice(0, 5)
      .map((b) => ({ name: b.name, amount: b.amount, dueDay: b.dueDay! }));

    await sendMonthlyOverview(adminUser.email, {
      month: format(now, "MMMM", { locale: ptBR }),
      year,
      totalBills,
      paidBills: totalPaid,
      pendingBills: totalPending,
      totalIncome,
      balance: totalIncome - totalBills,
      upcomingDue,
    });
  }

  // Due soon alerts - check bills due in 3 days
  const dueSoon = bills
    .filter((b) => !b.isPaid && b.dueDay)
    .filter((b) => {
      const daysLeft = (b.dueDay || 0) - day;
      return daysLeft >= 0 && daysLeft <= 3;
    })
    .map((b) => ({
      name: b.name,
      amount: b.amount,
      dueDay: b.dueDay!,
      daysLeft: (b.dueDay || 0) - day,
    }));

  if (dueSoon.length > 0) {
    await sendDueSoonAlert(adminUser.email, dueSoon);
  }

  // Future bills reminders
  const futureCandidates = await db.query.futureBills.findMany({
    where: and(eq(schema.futureBills.userId, adminUser.id), eq(schema.futureBills.notified, false)),
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const futureToNotify = futureCandidates.filter((f) => {
    if (!f.reminderDate) return false;
    const rem = parseISO(f.reminderDate);
    rem.setHours(0, 0, 0, 0);
    const diff = Math.ceil((rem.getTime() - today.getTime()) / MS_PER_DAY);
    return diff >= 0 && diff <= (f.notifyDaysBefore ?? 3);
  });

  if (futureToNotify.length > 0) {
    // send email with list
    await sendFutureBillReminder(adminUser.email, futureToNotify.map((f) => ({ name: f.name, amount: f.amount || 0, reminderDate: f.reminderDate, id: f.id })));
    // mark as notified
    for (const f of futureToNotify) {
      await db.update(schema.futureBills).set({ notified: true }).where(eq(schema.futureBills.id, f.id));
    }
  }

  return NextResponse.json({ ok: true, processed: { dueSoon: dueSoon.length, isMonthStart: day === 1 } });
}
