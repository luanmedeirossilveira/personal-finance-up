// Ação pendente de confirmação (escrita pelo WhatsApp nunca grava direto). Regras puras.
import type { SpendingCategory } from "@/lib/categories";

export const PENDING_TTL_MS = 10 * 60 * 1000;

export interface ExpensePayload {
  valor: number;
  descricao: string;
  /** Nula enquanto a pessoa ainda escolhe entre `categoryOptions`. */
  categoria: SpendingCategory | null;
  data: string; // YYYY-MM-DD
  categoryOptions?: SpendingCategory[];
}

export const pendingExpiresAt = (now: Date) => new Date(now.getTime() + PENDING_TTL_MS).toISOString();

export const isPendingExpired = (expiresAt: string, now: Date) => new Date(expiresAt).getTime() <= now.getTime();

export function parseExpensePayload(raw: string): ExpensePayload | null {
  try {
    const p = JSON.parse(raw) as ExpensePayload;
    if (typeof p.valor !== "number" || typeof p.descricao !== "string" || typeof p.data !== "string") return null;
    return p;
  } catch {
    return null;
  }
}
