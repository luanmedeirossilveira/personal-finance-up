// Patrimônio líquido = contas + investimentos − dívidas. Retrato diário em net_worth_snapshots.
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getDebtBalances, totalDebt } from "@/lib/debts";
import { todayISO } from "@/lib/month";

export interface NetWorth {
  accountsTotal: number;
  investmentsTotal: number;
  debtsTotal: number;
  netWorth: number;
}

export async function computeNetWorth(userId: number): Promise<NetWorth> {
  const [accounts, investments, debts] = await Promise.all([
    db.query.accounts.findMany({ where: and(eq(schema.accounts.userId, userId), eq(schema.accounts.archived, false)) }),
    db.query.investments.findMany({ where: eq(schema.investments.userId, userId) }),
    getDebtBalances(userId),
  ]);
  // Cartões não entram: são limite planejado (Revisão/Mês), não patrimônio. A fatura do mês já é
  // uma conta do Mês. Conta de investimento: as posições já contam em investimentos.
  const accountsTotal = accounts.reduce((s, a) => (a.type === "investment" || a.type === "credit" ? s : s + a.balance), 0);
  const investmentsTotal = investments.reduce((s, i) => s + i.balance, 0);
  const debtsTotal = totalDebt(debts);
  return { accountsTotal, investmentsTotal, debtsTotal, netWorth: accountsTotal + investmentsTotal - debtsTotal };
}

export async function saveNetWorthSnapshot(userId: number, now = new Date()) {
  const nw = await computeNetWorth(userId);
  const date = todayISO(now);
  await db
    .insert(schema.netWorthSnapshots)
    .values({ userId, date, ...nw })
    .onConflictDoUpdate({
      target: [schema.netWorthSnapshots.userId, schema.netWorthSnapshots.date],
      set: { ...nw },
    });
  return nw;
}

export async function netWorthHistory(userId: number, limit = 400) {
  const rows = await db.query.netWorthSnapshots.findMany({
    where: eq(schema.netWorthSnapshots.userId, userId),
    orderBy: [desc(schema.netWorthSnapshots.date)],
    limit,
  });
  return rows.reverse();
}
