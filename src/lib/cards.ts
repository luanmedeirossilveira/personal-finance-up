// Cartões como limite planejado: quanto foi usado no mês (faturas do Mês) contra o planejado,
// mais a fatura em aberto quando o cartão vem do Open Finance. Não entram no patrimônio líquido.
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

type Bill = typeof schema.bills.$inferSelect;

export interface CardUsage {
  id: number | null; // null = fatura do Mês sem cartão planejado
  name: string;
  ownership: "mine" | "hers" | "joint";
  monthlyLimit: number;
  matchTerms: string[];
  accountId: number | null;
  /** Soma das faturas do mês (período) que pertencem ao cartão. */
  used: number;
  ratio: number | null;
  bills: { id: number; name: string; amount: number; isPaid: boolean }[];
  /** Fatura em aberto informada pelo banco (cartão sincronizado). */
  openBill: { amount: number; dueDate: string | null } | null;
}

export const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function parseTerms(raw: string) {
  return raw
    .split(",")
    .map((t) => normalizeText(t.trim()))
    .filter(Boolean);
}

// Puro (testável): a fatura é do cartão se o nome/apelido contém alguma das palavras.
export function billMatchesCard(bill: Pick<Bill, "name" | "cardNickname">, terms: string[]) {
  if (terms.length === 0) return false;
  const text = normalizeText(`${bill.name} ${bill.cardNickname ?? ""}`);
  return terms.some((t) => text.includes(t));
}

export async function getCardsUsage(userId: number, month: number, year: number): Promise<CardUsage[]> {
  let cards: (typeof schema.cards.$inferSelect)[] = [];
  try {
    cards = await db.query.cards.findMany({ where: eq(schema.cards.userId, userId), orderBy: [schema.cards.createdAt] });
  } catch {
    cards = []; // tabela ainda não migrada
  }
  const [cardBills, accounts] = await Promise.all([
    db.query.bills.findMany({
      where: and(
        eq(schema.bills.userId, userId),
        eq(schema.bills.month, month),
        eq(schema.bills.year, year),
        eq(schema.bills.type, "CARD"),
      ),
    }),
    db.query.accounts.findMany({ where: and(eq(schema.accounts.userId, userId), eq(schema.accounts.type, "credit")) }),
  ]);

  const claimed = new Set<number>();
  const usage: CardUsage[] = cards.map((c) => {
    const terms = parseTerms(c.matchTerms);
    const bills = cardBills.filter((b) => !claimed.has(b.id) && billMatchesCard(b, terms));
    bills.forEach((b) => claimed.add(b.id));
    const used = bills.reduce((s, b) => s + b.amount, 0);
    const account = accounts.find((a) => a.id === c.accountId);
    return {
      id: c.id,
      name: c.name,
      ownership: c.ownership,
      monthlyLimit: c.monthlyLimit,
      matchTerms: terms,
      accountId: c.accountId,
      used,
      ratio: c.monthlyLimit > 0 ? used / c.monthlyLimit : null,
      bills: bills.map((b) => ({ id: b.id, name: b.name, amount: b.amount, isPaid: Boolean(b.isPaid) })),
      openBill:
        account && account.openBillAmount !== null
          ? { amount: account.openBillAmount, dueDate: account.billDueDate }
          : null,
    };
  });

  // Faturas do Mês que nenhum cartão reconheceu continuam aparecendo (sem limite planejado).
  for (const b of cardBills.filter((b) => !claimed.has(b.id))) {
    usage.push({
      id: null,
      name: b.cardNickname || b.name,
      ownership: b.ownership,
      monthlyLimit: 0,
      matchTerms: [],
      accountId: null,
      used: b.amount,
      ratio: null,
      bills: [{ id: b.id, name: b.name, amount: b.amount, isPaid: Boolean(b.isPaid) }],
      openBill: null,
    });
  }
  return usage;
}
