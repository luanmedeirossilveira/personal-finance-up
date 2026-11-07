import { Suspense } from "react";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getDebtBalances, totalDebt } from "@/lib/debts";
import { getDefaultPeriod } from "@/lib/month";
import PatrimonioView from "@/components/patrimonio/PatrimonioView";

export const dynamic = "force-dynamic";

export default async function PatrimonioPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const period = getDefaultPeriod(new Date());
  const [debts, investBills] = await Promise.all([
    getDebtBalances(user.id),
    db.query.bills.findMany({
      where: and(
        eq(schema.bills.userId, user.id),
        eq(schema.bills.category, "investimentos"),
        eq(schema.bills.isPaid, true),
      ),
    }),
  ]);
  const open = debts.filter((d) => !d.isPaid);

  const summary = {
    debtTotal: totalDebt(debts),
    debtCount: open.length,
    investedTotal: investBills.reduce((s, b) => s + b.amount, 0),
    investedMonth: investBills
      .filter((b) => b.month === period.month && b.year === period.year)
      .reduce((s, b) => s + b.amount, 0),
    debts: open.map(({ id, name, amount, paid, remaining, payoff }) => ({ id, name, amount, paid, remaining, payoff })),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Patrimônio</h1>
        <p className="text-sm mt-1" style={{ color: "rgb(var(--text-muted))" }}>
          Estou indo para onde quero? Contas, investimentos e dívidas num número só.
        </p>
      </header>
      <Suspense fallback={null}>
        <PatrimonioView summary={summary} />
      </Suspense>
    </div>
  );
}
