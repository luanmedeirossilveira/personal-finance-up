// src/app/revisao/page.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import CheckinManager from "@/components/checkin/CheckinManager";

function getISOWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export default async function RevisaoPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const weekNumber = getISOWeek(now);

  // Dados financeiros do mês atual para contexto no check-in
  const [bills, salaries, recentCheckins] = await Promise.all([
    db.query.bills.findMany({
      where: and(
        eq(schema.bills.userId, user.id),
        eq(schema.bills.month, month),
        eq(schema.bills.year, year),
      ),
    }),
    db.query.salaries.findMany({
      where: and(
        eq(schema.salaries.userId, user.id),
        eq(schema.salaries.month, month),
        eq(schema.salaries.year, year),
      ),
    }),
    db.query.weeklyCheckins.findMany({
      where: eq(schema.weeklyCheckins.userId, user.id),
      orderBy: [desc(schema.weeklyCheckins.createdAt)],
      limit: 6,
    }),
  ]);

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const paidBills = bills
    .filter((b) => b.isPaid)
    .reduce((s, b) => s + b.amount, 0);
  const pendingBills = bills
    .filter((b) => !b.isPaid)
    .reduce((s, b) => s + b.amount, 0);
  const totalIncome = salaries.reduce((s, s2) => s + s2.amount, 0);

  const dueSoon = bills
    .filter((b) => !b.isPaid && b.dueDay)
    .filter((b) => {
      const diff = (b.dueDay ?? 0) - now.getDate();
      return diff >= 0 && diff <= 5;
    })
    .sort((a, b) => (a.dueDay ?? 0) - (b.dueDay ?? 0))
    .slice(0, 4)
    .map((b) => ({ name: b.name, amount: b.amount, dueDay: b.dueDay! }));

  const doneThisWeek = recentCheckins.some(
    (c) =>
      c.weekNumber === weekNumber && c.year === year && c.type === "weekly",
  );
  const doneThisMonth = recentCheckins.some(
    (c) => c.month === month && c.year === year && c.type === "monthly",
  );

  const context = {
    month,
    year,
    weekNumber,
    totalBills,
    paidBills,
    pendingBills,
    totalIncome,
    balance: totalIncome - totalBills,
    billCount: bills.length,
    paidCount: bills.filter((b) => b.isPaid).length,
    dueSoon,
    doneThisWeek,
    doneThisMonth,
    recentCheckins: recentCheckins.map((c) => ({
      id: c.id,
      weekNumber: c.weekNumber,
      month: c.month,
      year: c.year,
      type: c.type,
      createdAt: c.createdAt,
      data: JSON.parse(c.data),
    })),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1
          className="text-2xl font-black tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Revisão
        </h1>
        <p className="text-sm mt-1" style={{ color: "#4a6b58" }}>
          Check-in semanal e fechamento mensal do casal
        </p>
      </div>
      <Suspense
        fallback={
          <div className="card p-8 text-center" style={{ color: "#4a6b58" }}>
            Carregando...
          </div>
        }
      >
        <CheckinManager context={context} />
      </Suspense>
    </div>
  );
}
