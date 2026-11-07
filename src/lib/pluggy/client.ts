// Cliente Pluggy (MeuPluggy via Open Finance) — SOMENTE no servidor.
// Segredos em env (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET); no banco guardamos só o itemId.
// Transações usam GET /v2/transactions (cursor): o GET /transactions paginado sai em 31/12/2026.

const BASE_URL = process.env.PLUGGY_API_URL || "https://api.pluggy.ai";

export interface PluggyItem {
  id: string;
  status: string;
  connector?: { name?: string };
  error?: { message?: string } | null;
}

export interface PluggyAccount {
  id: string;
  type: "BANK" | "CREDIT" | string;
  subtype?: string; // CHECKING_ACCOUNT | SAVINGS_ACCOUNT | CREDIT_CARD
  name: string;
  marketingName?: string | null;
  number?: string | null;
  balance: number;
  creditData?: {
    balanceCloseDate?: string | null;
    balanceDueDate?: string | null;
    billClosingDate?: string | null;
    billForecastDate?: string | null;
  } | null;
  billClosingDate?: string | null;
  billForecastDate?: string | null;
}

export interface PluggyTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "DEBIT" | "CREDIT";
  category?: string | null;
}

export interface PluggyInvestment {
  id: string;
  name: string;
  type?: string; // FIXED_INCOME | MUTUAL_FUND | SECURITY | EQUITY | ETF | COE
  subtype?: string | null; // CDB | LCI | LCA | TREASURY | ...
  balance?: number | null;
  amount?: number | null;
  amountOriginal?: number | null;
  dueDate?: string | null;
  status?: string | null; // ACTIVE | PENDING | TOTAL_WITHDRAWAL
}

export function isPluggyConfigured() {
  return Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

let cachedKey: { value: string; expiresAt: number } | null = null;

async function getApiKey(): Promise<string> {
  if (cachedKey && cachedKey.expiresAt > Date.now()) return cachedKey.value;
  if (!isPluggyConfigured()) throw new Error("Pluggy não configurado (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET).");
  const res = await fetch(`${BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Pluggy auth ${res.status}`);
  const { apiKey } = (await res.json()) as { apiKey: string };
  // A apiKey vale 2h; renova com folga.
  cachedKey = { value: apiKey, expiresAt: Date.now() + 100 * 60_000 };
  return apiKey;
}

async function pluggyGet<T>(path: string): Promise<T> {
  const apiKey = await getApiKey();
  const res = await fetch(`${BASE_URL}${path}`, { headers: { "X-API-KEY": apiKey }, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pluggy ${path.split("?")[0]} ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export function getItem(itemId: string) {
  return pluggyGet<PluggyItem>(`/items/${encodeURIComponent(itemId)}`);
}

export async function listAccounts(itemId: string) {
  const data = await pluggyGet<{ results: PluggyAccount[] }>(`/accounts?itemId=${encodeURIComponent(itemId)}`);
  return data.results ?? [];
}

export async function listInvestments(itemId: string) {
  const data = await pluggyGet<{ results: PluggyInvestment[] }>(`/investments?itemId=${encodeURIComponent(itemId)}`);
  return data.results ?? [];
}

export interface PluggyBill {
  id: string;
  dueDate: string;
  billClosingDate?: string | null;
  totalAmount: number;
}

// Faturas do cartão (fechadas). A "em aberto" é a de vencimento mais próximo a partir de hoje.
export async function listCardBills(accountId: string) {
  const data = await pluggyGet<{ results: PluggyBill[] }>(`/bills?accountId=${encodeURIComponent(accountId)}`);
  return data.results ?? [];
}

export function pickOpenBill(bills: PluggyBill[], today: string) {
  const upcoming = bills.filter((b) => b.dueDate.slice(0, 10) >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return upcoming[0] ?? null;
}

// Percorre o cursor até `next` vir nulo. `next` já é uma query string pronta ("?accountId=...&after=...").
export async function listTransactions(accountId: string, from: string): Promise<PluggyTransaction[]> {
  const all: PluggyTransaction[] = [];
  // v2 usa `dateFrom` (o `from` do endpoint antigo é rejeitado com 400).
  let query: string | null = `?accountId=${encodeURIComponent(accountId)}&dateFrom=${from}`;
  for (let page = 0; query && page < 50; page++) {
    const data: { results: PluggyTransaction[]; next?: string | null } = await pluggyGet(`/v2/transactions${query}`);
    all.push(...(data.results ?? []));
    query = data.next ? (data.next.startsWith("?") ? data.next : `?${data.next}`) : null;
  }
  return all;
}
