// Sincroniza as conexões Pluggy do usuário: contas, transações (idempotente por pluggy id),
// investimentos; depois concilia e grava o retrato do patrimônio.
// Contas manuais continuam valendo: se a conexão cair, o app segue funcionando como antes.
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { saveNetWorthSnapshot } from "@/lib/networth";
import { reconcilePending } from "@/lib/reconcile";
import { todayISO } from "@/lib/month";
import {
  getItem,
  isPluggyConfigured,
  listCardBills,
  pickOpenBill,
  listAccounts,
  listInvestments,
  listTransactions,
  type PluggyAccount,
  type PluggyInvestment,
} from "./client";

const FIRST_SYNC_DAYS = 90;
const INSERT_CHUNK = 100; // linhas por INSERT: poucas idas ao banco mesmo com centenas de transações
const OVERLAP_DAYS = 7; // reprocessa a última semana: transações pendentes podem mudar

type AccountType = (typeof schema.accounts.$inferSelect)["type"];

export function mapAccountType(a: Pick<PluggyAccount, "type" | "subtype">): AccountType {
  if (a.type === "CREDIT" || a.subtype === "CREDIT_CARD") return "credit";
  if (a.subtype === "SAVINGS_ACCOUNT") return "savings";
  return "checking";
}

export function mapInvestmentType(i: Pick<PluggyInvestment, "type" | "subtype">): string {
  const sub = (i.subtype || "").toUpperCase();
  if (sub.includes("CDB")) return "cdb";
  if (sub === "REAL_ESTATE_FUND") return "fundo";
  if (sub.includes("LCI") || sub.includes("LCA")) return "lci_lca";
  if (sub.includes("TREASURY") || sub.includes("TESOURO")) return "tesouro";
  const type = (i.type || "").toUpperCase();
  if (type === "MUTUAL_FUND") return "fundo";
  if (type === "EQUITY" || type === "ETF" || type === "SECURITY") return "acao";
  if (sub.includes("PENSION") || sub.includes("PREVID")) return "previdencia";
  return "outro";
}

// DEBIT sempre saída (negativo), CREDIT entrada — independente do sinal que o conector usa.
export function signedAmount(t: { amount: number; type: string }) {
  return t.type === "DEBIT" ? -Math.abs(t.amount) : Math.abs(t.amount);
}

// Falhas de rede passageiras (proxy derrubando a conexão com o Turso) não devem abortar o sync.
function isTransient(e: unknown) {
  const text = `${(e as Error)?.message ?? ""} ${String((e as { cause?: unknown })?.cause ?? "")}`;
  const code = (e as { cause?: { cause?: { code?: string }; code?: string } })?.cause;
  return /ECONNRESET|ETIMEDOUT|EPIPE|fetch failed|socket hang up/i.test(text) || code?.code === "ECONNRESET" || code?.cause?.code === "ECONNRESET";
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || !isTransient(e)) throw e;
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

function chunk<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function daysAgo(n: number, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return todayISO(d);
}

export interface SyncResult {
  items: number;
  accounts: number;
  transactions: number;
  investments: number;
  matched: number;
  errors: string[];
}

export async function syncUser(userId: number): Promise<SyncResult> {
  const result: SyncResult = { items: 0, accounts: 0, transactions: 0, investments: 0, matched: 0, errors: [] };
  if (!isPluggyConfigured()) {
    result.errors.push("Pluggy não configurado");
    return result;
  }

  const items = await db.query.pluggyItems.findMany({ where: eq(schema.pluggyItems.userId, userId) });
  const now = new Date().toISOString();

  for (const item of items) {
    try {
      const remote = await getItem(item.itemId);
      const accounts = await listAccounts(item.itemId);

      for (const acc of accounts) {
        const closing = acc.billClosingDate ?? acc.creditData?.billClosingDate ?? acc.creditData?.balanceCloseDate ?? null;
        const due = acc.billForecastDate ?? acc.creditData?.billForecastDate ?? acc.creditData?.balanceDueDate ?? null;
        const values = {
          name: acc.marketingName || acc.name,
          type: mapAccountType(acc),
          institution: remote.connector?.name ?? null,
          number: acc.number ? acc.number.slice(-4) : null,
          balance: acc.balance ?? 0,
          billClosingDate: closing ? closing.slice(0, 10) : null,
          billDueDate: due ? due.slice(0, 10) : null,
          lastSyncAt: now,
          updatedAt: now,
        };
        const previous = await db.query.accounts.findFirst({ where: eq(schema.accounts.pluggyAccountId, acc.id) });
        const [local] = await withRetry(() => db
          .insert(schema.accounts)
          .values({ userId, source: "pluggy", ownership: "mine", pluggyAccountId: acc.id, pluggyItemId: item.itemId, ...values })
          .onConflictDoUpdate({ target: schema.accounts.pluggyAccountId, set: values })
          .returning());
        result.accounts++;

        // Cartão: guarda a fatura em aberto (vencimento mais próximo) — o balance é o limite usado.
        if (values.type === "credit") {
          try {
            const open = pickOpenBill(await listCardBills(acc.id), todayISO());
            if (open) {
              await withRetry(() =>
                db
                  .update(schema.accounts)
                  .set({
                    openBillAmount: open.totalAmount,
                    billDueDate: open.dueDate.slice(0, 10),
                    billClosingDate: open.billClosingDate ? open.billClosingDate.slice(0, 10) : values.billClosingDate,
                  })
                  .where(eq(schema.accounts.id, local.id)),
              );
            }
          } catch (e) {
            result.errors.push(`fatura (${values.name}): ${(e as Error).message}`);
          }
        }

        const from = previous?.lastSyncAt ? daysAgo(OVERLAP_DAYS) : daysAgo(FIRST_SYNC_DAYS);
        // Falha nas transações de uma conta não impede saldos e investimentos.
        let txs: Awaited<ReturnType<typeof listTransactions>> = [];
        try {
          txs = await listTransactions(acc.id, from);
        } catch (e) {
          result.errors.push(`transações (${values.name}): ${(e as Error).message}`);
        }
        const rows = txs.map((t) => ({
          userId,
          accountId: local.id,
          source: "pluggy" as const,
          externalId: t.id,
          date: t.date.slice(0, 10),
          amount: signedAmount(t),
          description: t.description,
          category: null,
          ownership: "mine" as const,
        }));
        for (const part of chunk(rows, INSERT_CHUNK)) {
          await withRetry(() => db.insert(schema.bankTransactions).values(part).onConflictDoNothing());
          result.transactions += part.length;
        }
      }

      // Investimentos têm conector próprio; via MeuPluggy podem não vir (fallback: manual).
      try {
        const invs = await listInvestments(item.itemId);
        const known = new Set(
          (await db.query.investments.findMany({ where: eq(schema.investments.userId, userId) }))
            .map((i) => i.pluggyInvestmentId)
            .filter(Boolean),
        );
        for (const inv of invs) {
          // Posição totalmente resgatada: só atualiza (para zerar) se já estava salva.
          const withdrawn = inv.status === "TOTAL_WITHDRAWAL" || !(inv.balance ?? inv.amount);
          if (withdrawn && !known.has(inv.id)) continue;
          const values = {
            name: inv.name,
            type: mapInvestmentType(inv),
            // Fundos e ações não informam o aplicado (amountOriginal = null): usa o valor atual.
            appliedAmount: withdrawn ? 0 : inv.amountOriginal ?? inv.balance ?? inv.amount ?? 0,
            balance: withdrawn ? 0 : inv.balance ?? inv.amount ?? 0,
            dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : null,
            updatedAt: now,
          };
          await withRetry(() =>
            db
              .insert(schema.investments)
              .values({ userId, source: "pluggy", pluggyInvestmentId: inv.id, ...values })
              .onConflictDoUpdate({ target: schema.investments.pluggyInvestmentId, set: values }),
          );
          result.investments++;
        }
      } catch (e) {
        result.errors.push(`investimentos: ${(e as Error).message}`);
      }

      await db
        .update(schema.pluggyItems)
        .set({ status: remote.status, connectorName: remote.connector?.name ?? item.connectorName, lastSyncAt: now, lastError: null })
        .where(and(eq(schema.pluggyItems.id, item.id), eq(schema.pluggyItems.userId, userId)));
      result.items++;
    } catch (e) {
      // Guarda só a causa (a mensagem do Drizzle repete a query inteira).
      const cause = (e as { cause?: Error }).cause;
      const message = cause?.message ? `${cause.message}` : (e as Error).message;
      result.errors.push(message);
      try {
        await withRetry(() =>
          db.update(schema.pluggyItems).set({ lastError: message.slice(0, 300) }).where(eq(schema.pluggyItems.id, item.id)),
        );
      } catch {
        // sem conexão nem para registrar o erro: ele já vai na resposta do sync
      }
    }
  }

  // Passos finais isolados: falha num deles não perde o que já foi sincronizado.
  const steps: [string, () => Promise<unknown>][] = [
    ["conciliação", async () => (result.matched = await reconcilePending(userId))],
    ["compras do cartão já lançadas", () => markKnownCardPurchases(userId)],
    ["retrato do patrimônio", () => saveNetWorthSnapshot(userId)],
  ];
  for (const [label, run] of steps) {
    try {
      await withRetry(run);
    } catch (e) {
      result.errors.push(`${label}: ${(e as { cause?: Error }).cause?.message ?? (e as Error).message}`);
    }
  }
  if (result.items > 0) {
    await withRetry(() =>
      db.update(schema.pluggyItems).set({ lastError: result.errors.length ? result.errors.join(" | ").slice(0, 300) : null }).where(eq(schema.pluggyItems.userId, userId)),
    ).catch(() => undefined);
  }
  return result;
}

// Compras do cartão vindas do banco NÃO entram sozinhas na fatura (você pode ter lançado à mão).
// Aqui só marcamos as que já existem numa fatura do Mês (mesmo valor, data a ±1 dia); as demais
// ficam como "novas compras no cartão" no Mês, para você decidir.
async function markKnownCardPurchases(userId: number) {
  const creditAccounts = await db.query.accounts.findMany({
    where: and(eq(schema.accounts.userId, userId), eq(schema.accounts.type, "credit")),
  });
  if (creditAccounts.length === 0) return;

  const cardBills = await db.query.bills.findMany({
    where: and(eq(schema.bills.userId, userId), eq(schema.bills.type, "CARD")),
  });
  if (cardBills.length === 0) return;
  const txByBill = new Map<number, { amount: number; date: string | null }[]>();
  for (const b of cardBills) txByBill.set(b.id, []);
  for (const t of await db.query.cardTransactions.findMany({ where: inArray(schema.cardTransactions.billId, cardBills.map((b) => b.id)) })) {
    txByBill.get(t.billId)?.push({ amount: t.amount, date: t.date });
  }
  const dayDiff = (a: string, b: string) =>
    Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 86_400_000;

  for (const acc of creditAccounts) {
    const pending = await db.query.bankTransactions.findMany({
      where: and(
        eq(schema.bankTransactions.userId, userId),
        eq(schema.bankTransactions.accountId, acc.id),
        eq(schema.bankTransactions.status, "pending"),
      ),
    });
    const known: { txId: number; billId: number }[] = [];
    for (const tx of pending) {
      if (tx.amount >= 0) continue;
      const value = Math.abs(tx.amount);
      for (const [billId, list] of Array.from(txByBill.entries())) {
        const i = list.findIndex((r) => Math.abs(r.amount - value) < 0.01 && r.date && dayDiff(r.date, tx.date) <= 1);
        if (i >= 0) {
          list.splice(i, 1); // cada lançamento manual reconhece uma transação só
          known.push({ txId: tx.id, billId });
          break;
        }
      }
    }
    for (const k of known) {
      await withRetry(() =>
        db
          .update(schema.bankTransactions)
          .set({ billId: k.billId, status: "categorized" })
          .where(eq(schema.bankTransactions.id, k.txId)),
      );
    }
  }
}
