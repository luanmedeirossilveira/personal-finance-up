// src/components/bills/BillsManager.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import showConfirm from "@/components/ui/confirm";
import showToast from "@/components/ui/toast";
import ModalPortal from "@/components/ui/ModalPortal";
import SalariesManager from "@/components/salaries/SalariesManager";
import BillForm from "./BillForm";
import BillsMobileActions from "./BillsMobileActions";
import CardBillTransactions from "./CardBillTransactions";
import CategoryBudgets from "./CategoryBudgets";
import MealCardsManager from "@/components/meal-cards/MealCardsManager";
import type { BillOwnership } from "@/lib/db/schema";

export interface Bill {
  id: number;
  name: string;
  amount: number;
  month: number;
  year: number;
  installment?: string;
  isPaid: boolean;
  dueDay?: number;
  category?: string;
  ownership: BillOwnership;
  notes?: string;
  barCode?: string | null;
  qrCode?: string | null;
  type?: "NORMAL" | "CARD";
  cardLast4?: string | null;
  cardNickname?: string | null;
  date?: string | null;
}

export interface Salary {
  id: number;
  person: string;
  amount: number;
}

export interface Attachments {
  fatura?: { fileId: string; url: string; name: string };
  comprovante?: { fileId: string; url: string; name: string };
}

interface CardTransaction {
  id: number;
  name: string;
  amount: number;
  installment?: string | null;
  category?: string | null;
  date?: string | null;
}

// Plano de migração — construído ao abrir o modal, permite escolher quais contas
// (e, dentro de faturas de cartão, quais parcelas) serão migradas para o próximo mês.
interface MigrateNormalItem {
  bill: Bill;
  nextInstallment: string | null;
}
interface MigrateParcela {
  id: number;
  name: string;
  amount: number;
  installment: string | null;
  nextInstallment: string;
  category: string | null;
  date: string | null;
}
interface MigrateCardItem {
  bill: Bill;
  parcelas: MigrateParcela[];
}
interface MigratePlan {
  normal: MigrateNormalItem[];
  cards: MigrateCardItem[];
  nextMonth: number;
  nextYear: number;
}

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// Evita bug de fuso horário: "YYYY-MM-DD" formatado sem passar por Date/UTC.
function formatDateBR(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

function getNextMonthYear(month: number, year: number) {
  if (month === 12) return { nextMonth: 1, nextYear: year + 1 };
  return { nextMonth: month + 1, nextYear: year };
}

function incrementInstallment(installment?: string) {
  const normalized = (installment || "").trim();
  if (!normalized) return null;

  const installmentRegex = /^(\d+)\s*\/\s*(\d+)$/;
  const match = installmentRegex.exec(normalized);
  if (!match) return normalized;

  const current = Number.parseInt(match[1], 10);
  const total = Number.parseInt(match[2], 10);
  if (!Number.isFinite(current) || !Number.isFinite(total) || current >= total) {
    return null;
  }

  return `${current + 1}/${total}`;
}

function incrementStrictInstallment(installment?: string | null) {
  const normalized = (installment || "").trim();
  if (!normalized) return null;

  const installmentRegex = /^(\d+)\s*\/\s*(\d+)$/;
  const match = installmentRegex.exec(normalized);
  if (!match) return null;

  const current = Number.parseInt(match[1], 10);
  const total = Number.parseInt(match[2], 10);
  if (!Number.isFinite(current) || !Number.isFinite(total) || current >= total) {
    return null;
  }

  return `${current + 1}/${total}`;
}

// v2: configuração visual de ownership
const OWNERSHIP_CONFIG: Record<
  BillOwnership | "all",
  { label: string; emoji: string; color: string; activeBg: string }
> = {
  all: { label: "Todas", emoji: "📋", color: "#8dcdb0", activeBg: "#2a3d31" },
  mine: { label: "Minhas", emoji: "🧑", color: "#93c5fd", activeBg: "#1d4ed8" },
  joint: {
    label: "Conjuntas",
    emoji: "🤝",
    color: "#86efac",
    activeBg: "#389671",
  },
  hers: { label: "Dela", emoji: "👩", color: "#f9a8d4", activeBg: "#be185d" },
};

const OWNERSHIP_BADGE: Record<
  BillOwnership,
  { label: string; color: string; bg: string }
> = {
  mine: { label: "Minha", color: "#93c5fd", bg: "#1e2d3d" },
  joint: { label: "Conjunta", color: "#86efac", bg: "#1c3025" },
  hers: { label: "Dela", color: "#f9a8d4", bg: "#2d1f2a" },
};

type OwnershipFilter = BillOwnership | "all";

export default function BillsManager() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const now = new Date();
  const [month, setMonth] = useState(
    Number.parseInt(searchParams.get("month") || String(now.getMonth() + 1), 10),
  );
  const [year, setYear] = useState(
    Number.parseInt(searchParams.get("year") || String(now.getFullYear()), 10),
  );
  const [ownershipFilter, setOwnershipFilter] =
    useState<OwnershipFilter>("all");

  const [bills, setBills] = useState<Bill[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [showSalaries, setShowSalaries] = useState(false);
  const [expandedCardBills, setExpandedCardBills] = useState<number[]>([]);
  const [migrating, setMigrating] = useState(false);
  const [preparingMigration, setPreparingMigration] = useState(false);
  const [migratePlan, setMigratePlan] = useState<MigratePlan | null>(null);
  const [selectedBills, setSelectedBills] = useState<Set<number>>(new Set());
  const [selectedParcelas, setSelectedParcelas] = useState<Record<number, Set<number>>>({});
  const [expandedMigrateCards, setExpandedMigrateCards] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [billsRes, salariesRes] = await Promise.all([
      fetch(`/api/bills?month=${month}&year=${year}`),
      fetch(`/api/salaries?month=${month}&year=${year}`),
    ]);
    const [b, s] = await Promise.all([billsRes.json(), salariesRes.json()]);
    setBills(b);
    setSalaries(s);
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function navigate(newMonth: number, newYear: number) {
    setMonth(newMonth);
    setYear(newYear);
    router.push(`/contas?month=${newMonth}&year=${newYear}`, { scroll: false });
  }

  function prevMonth() {
    if (month === 1) navigate(12, year - 1);
    else navigate(month - 1, year);
  }

  function nextMonth() {
    if (month === 12) navigate(1, year + 1);
    else navigate(month + 1, year);
  }

  // Etapa 1 — monta o plano de migração (contas normais elegíveis + parcelas de
  // cartão que avançam) e abre o modal de seleção. Nada é gravado aqui.
  async function prepareMigration() {
    if (bills.length === 0) {
      showToast("Sem contas para migrar neste mês.");
      return;
    }
    setPreparingMigration(true);
    try {
      const { nextMonth, nextYear } = getNextMonthYear(month, year);

      const normal: MigrateNormalItem[] = [];
      for (const bill of bills.filter((b) => b.type !== "CARD")) {
        const nextInstallment = incrementInstallment(bill.installment);
        if (bill.installment && !nextInstallment) continue; // parcela encerrada
        normal.push({ bill, nextInstallment });
      }

      const cards: MigrateCardItem[] = [];
      for (const bill of bills.filter((b) => b.type === "CARD")) {
        const txRes = await fetch(`/api/bills/${bill.id}/transactions`);
        if (!txRes.ok) continue;
        const transactions: CardTransaction[] = await txRes.json();
        const parcelas = transactions
          .map((tx) => {
            const nextInstallment = incrementStrictInstallment(tx.installment);
            if (!nextInstallment) return null;
            return {
              id: tx.id,
              name: tx.name,
              amount: tx.amount,
              installment: tx.installment ?? null,
              nextInstallment,
              category: tx.category ?? null,
              date: tx.date ?? null,
            };
          })
          .filter((p): p is MigrateParcela => p !== null);
        if (parcelas.length === 0) continue;
        cards.push({ bill, parcelas });
      }

      if (normal.length === 0 && cards.length === 0) {
        showToast("Nenhuma conta elegível para migração.");
        return;
      }

      setMigratePlan({ normal, cards, nextMonth, nextYear });
      setSelectedBills(new Set(normal.map((n) => n.bill.id)));
      const parcelaSel: Record<number, Set<number>> = {};
      for (const c of cards) parcelaSel[c.bill.id] = new Set(c.parcelas.map((p) => p.id));
      setSelectedParcelas(parcelaSel);
      setExpandedMigrateCards(new Set());
    } catch {
      showToast("Não foi possível preparar a migração.");
    } finally {
      setPreparingMigration(false);
    }
  }

  function toggleMigrateBill(id: number) {
    setSelectedBills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMigrateParcela(billId: number, txId: number) {
    setSelectedParcelas((prev) => {
      const set = new Set(prev[billId] ?? []);
      if (set.has(txId)) set.delete(txId);
      else set.add(txId);
      return { ...prev, [billId]: set };
    });
  }

  function toggleMigrateCardAll(card: MigrateCardItem) {
    setSelectedParcelas((prev) => {
      const cur = prev[card.bill.id] ?? new Set<number>();
      const allSelected = card.parcelas.every((p) => cur.has(p.id));
      const set = allSelected
        ? new Set<number>()
        : new Set(card.parcelas.map((p) => p.id));
      return { ...prev, [card.bill.id]: set };
    });
  }

  function toggleExpandMigrateCard(id: number) {
    setExpandedMigrateCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Etapa 2 — grava apenas o que foi selecionado no modal.
  async function executeMigration() {
    if (!migratePlan) return;
    const { normal, cards, nextMonth, nextYear } = migratePlan;

    const chosenNormal = normal.filter((n) => selectedBills.has(n.bill.id));
    const chosenCards = cards
      .map((c) => ({
        bill: c.bill,
        parcelas: c.parcelas.filter((p) =>
          (selectedParcelas[c.bill.id] ?? new Set<number>()).has(p.id),
        ),
      }))
      .filter((c) => c.parcelas.length > 0);

    if (chosenNormal.length === 0 && chosenCards.length === 0) {
      showToast("Selecione ao menos uma conta para migrar.");
      return;
    }

    setMigratePlan(null);
    setMigrating(true);
    try {
      const existingRes = await fetch(`/api/bills?month=${nextMonth}&year=${nextYear}`);
      if (!existingRes.ok) throw new Error("Erro ao buscar contas do próximo mês");
      const existingNextMonthBills: Bill[] = await existingRes.json();

      const existingByName = new Map(
        existingNextMonthBills.map((b) => [b.name.trim().toLowerCase(), b]),
      );

      const requests: Promise<Response>[] = [];

      // --- Contas normais selecionadas: avança a parcela (texto) e soma por nome ---
      const normalPayloads = chosenNormal.map(({ bill, nextInstallment }) => ({
        name: bill.name,
        amount: bill.amount,
        month: nextMonth,
        year: nextYear,
        installment: nextInstallment,
        isPaid: false,
        dueDay: bill.dueDay || null,
        category: bill.category || null,
        ownership: bill.ownership,
        notes: bill.notes || null,
        barCode: bill.barCode || null,
        qrCode: bill.qrCode || null,
        type: bill.type || "NORMAL",
        cardLast4: bill.cardLast4 || null,
        cardNickname: bill.cardNickname || null,
        date: bill.date || null,
      }));

      const mergedByName = new Map<string, (typeof normalPayloads)[number]>();
      for (const payload of normalPayloads) {
        const key = payload.name.trim().toLowerCase();
        const existing = mergedByName.get(key);
        if (existing) {
          mergedByName.set(key, { ...existing, amount: existing.amount + payload.amount });
        } else {
          mergedByName.set(key, payload);
        }
      }

      for (const payload of Array.from(mergedByName.values())) {
        const existing = existingByName.get(payload.name.trim().toLowerCase());
        if (existing) {
          requests.push(fetch(`/api/bills/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: payload.amount }),
          }));
        } else {
          requests.push(fetch("/api/bills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }));
        }
      }

      // --- Faturas de cartão: só as parcelas selecionadas viram linhas reais ---
      // Ex.: "1/10" nesta fatura vira "2/10" na próxima, mesmo valor, até "10/10".
      let migratedCards = 0;
      for (const { bill, parcelas } of chosenCards) {
        const carried = parcelas.map((p) => ({
          name: p.name,
          amount: p.amount,
          installment: p.nextInstallment,
          category: p.category,
          date: p.date,
        }));

        const existing = existingByName.get(bill.name.trim().toLowerCase());
        if (existing) {
          // Idempotência: não duplicar parcelas já presentes na fatura do próximo mês.
          const existingTxRes = await fetch(`/api/bills/${existing.id}/transactions`);
          const existingTx: CardTransaction[] = existingTxRes.ok ? await existingTxRes.json() : [];
          const seen = new Set(
            existingTx.map((t) => `${t.name.trim().toLowerCase()}|${t.installment ?? ""}`),
          );
          const toAdd = carried.filter(
            (t) => !seen.has(`${t.name.trim().toLowerCase()}|${t.installment ?? ""}`),
          );
          for (const parcela of toAdd) {
            requests.push(fetch(`/api/bills/${existing.id}/transactions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parcela),
            }));
          }
          if (toAdd.length > 0) migratedCards += 1;
        } else {
          requests.push(fetch("/api/bills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: bill.name,
              amount: carried.reduce((sum, t) => sum + t.amount, 0),
              month: nextMonth,
              year: nextYear,
              installment: null,
              isPaid: false,
              dueDay: bill.dueDay || null,
              category: bill.category || null,
              ownership: bill.ownership,
              notes: bill.notes || null,
              barCode: bill.barCode || null,
              qrCode: bill.qrCode || null,
              type: "CARD" as const,
              cardLast4: bill.cardLast4 || null,
              cardNickname: bill.cardNickname || null,
              transactions: carried,
            }),
          }));
          migratedCards += 1;
        }
      }

      if (requests.length === 0) {
        showToast("Nenhuma conta elegível para migração.");
        return;
      }

      const responses = await Promise.all(requests);
      if (responses.some((res) => !res.ok)) {
        throw new Error("Erro ao migrar contas");
      }

      const totalMigrated = mergedByName.size + migratedCards;
      showToast(
        `${totalMigrated} conta(s) migrada(s) para ${MONTHS[nextMonth - 1]}/${nextYear}.`,
      );
    } catch {
      showToast("Não foi possível migrar as contas. Tente novamente.");
    } finally {
      setMigrating(false);
    }
  }

  async function togglePaid(bill: Bill) {
    const nextPaid = !bill.isPaid;
    const patch: { isPaid: boolean; date?: string } = { isPaid: nextPaid };
    // Ao marcar como paga, registra a data de pagamento (se ainda não houver uma definida).
    if (nextPaid && !bill.date) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      patch.date = `${yyyy}-${mm}-${dd}`;
    }
    await fetch(`/api/bills/${bill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBills((prev) =>
      prev.map((b) => (b.id === bill.id ? { ...b, ...patch } : b)),
    );
  }

  async function deleteBill(id: number) {
    const ok = await showConfirm("Remover esta conta?");
    if (!ok) return;
    await fetch(`/api/bills/${id}`, { method: "DELETE" });
    setBills((prev) => prev.filter((b) => b.id !== id));
  }

  function parseAttachments(raw?: string | null): Attachments {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async function handleUpload(
    billId: number,
    type: "fatura" | "comprovante",
    file?: File,
  ) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    await fetch(`/api/bills/${billId}/attachment`, {
      method: "POST",
      body: form,
    });
    fetchData();
  }

  async function handleDeleteAttachment(
    billId: number,
    type: "fatura" | "comprovante",
  ) {
    const ok = await showConfirm(`Remover ${type}?`);
    if (!ok) return;
    await fetch(`/api/bills/${billId}/attachment?type=${type}`, {
      method: "DELETE",
    });
    fetchData();
  }

  // v2: Filtra contas pela aba ativa
  const filteredBills =
    ownershipFilter === "all"
      ? bills
      : bills.filter((b) => b.ownership === ownershipFilter);

  const totalBills = filteredBills.reduce((s, b) => s + b.amount, 0);
  const pendingBills = filteredBills
    .filter((b) => !b.isPaid)
    .reduce((s, b) => s + b.amount, 0);
  const totalIncome = salaries.reduce((s, sal) => s + sal.amount, 0);
  // Saldo sempre usa total geral (não filtrado) para ser real
  const balance = totalIncome - bills.reduce((s, b) => s + b.amount, 0);

  const today = now.getDate();
  const isDueSoon = (bill: Bill) =>
    !bill.isPaid &&
    bill.dueDay &&
    month === now.getMonth() + 1 &&
    year === now.getFullYear() &&
    bill.dueDay - today >= 0 &&
    bill.dueDay - today <= 3;
  const isOverdue = (bill: Bill) =>
    !bill.isPaid &&
    bill.dueDay &&
    month === now.getMonth() + 1 &&
    year === now.getFullYear() &&
    bill.dueDay < today;

  return (
    <div className="space-y-5">
      {/* Modal de seleção de migração */}
      {migratePlan && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setMigratePlan(null)}
          />
          <div className="fixed inset-0 z-50 flex justify-center p-4 items-end sm:items-center">
            <div
              className="card rounded-t-2xl sm:rounded-2xl p-6 space-y-4 w-full sm:max-w-md max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h4 className="text-sm font-bold" style={{ color: "#f0f9f4" }}>
                  Migrar para {MONTHS[migratePlan.nextMonth - 1]}/{migratePlan.nextYear}
                </h4>
                <p className="text-[11px] mt-1" style={{ color: "#4a6b58" }}>
                  Escolha o que levar para o próximo mês. Parcelas avançam +1.
                </p>
              </div>

              {/* Contas normais */}
              {migratePlan.normal.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                    Contas
                  </span>
                  {migratePlan.normal.map(({ bill, nextInstallment }) => (
                    <label
                      key={bill.id}
                      className="flex items-center gap-2 p-2 rounded bg-[#0f1a15] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBills.has(bill.id)}
                        onChange={() => toggleMigrateBill(bill.id)}
                        className="accent-[#389671]"
                      />
                      <span className="flex-1 min-w-0 text-sm truncate" style={{ color: "#e6f7ef" }}>
                        {bill.name}
                        {nextInstallment && (
                          <span className="ml-1 text-[11px]" style={{ color: "#5ab28d" }}>
                            ({nextInstallment})
                          </span>
                        )}
                      </span>
                      <span className="text-xs" style={{ color: "#8dcdb0" }}>{BRL(bill.amount)}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Faturas de cartão com parcelas */}
              {migratePlan.cards.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                    Cartões — parcelas
                  </span>
                  {migratePlan.cards.map((card) => {
                    const sel = selectedParcelas[card.bill.id] ?? new Set<number>();
                    const allSelected = card.parcelas.every((p) => sel.has(p.id));
                    const expanded = expandedMigrateCards.has(card.bill.id);
                    return (
                      <div key={card.bill.id} className="rounded bg-[#0f1a15]">
                        <div className="flex items-center gap-2 p-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => toggleMigrateCardAll(card)}
                            className="accent-[#389671]"
                          />
                          <button
                            type="button"
                            onClick={() => toggleExpandMigrateCard(card.bill.id)}
                            className="flex-1 min-w-0 flex items-center gap-1 text-left"
                          >
                            <span className="flex-1 min-w-0 text-sm truncate" style={{ color: "#e6f7ef" }}>
                              {card.bill.name}
                            </span>
                            <span className="text-[11px]" style={{ color: "#4a6b58" }}>
                              {sel.size}/{card.parcelas.length}
                            </span>
                            {expanded ? (
                              <ChevronUp size={14} style={{ color: "#8dcdb0" }} />
                            ) : (
                              <ChevronDown size={14} style={{ color: "#8dcdb0" }} />
                            )}
                          </button>
                        </div>
                        {expanded && (
                          <div className="px-2 pb-2 space-y-1">
                            {card.parcelas.map((p) => (
                              <label
                                key={p.id}
                                className="flex items-center gap-2 pl-6 py-1 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={sel.has(p.id)}
                                  onChange={() => toggleMigrateParcela(card.bill.id, p.id)}
                                  className="accent-[#389671]"
                                />
                                <span className="flex-1 min-w-0 text-xs truncate" style={{ color: "#cbe8d8" }}>
                                  {p.name}
                                  <span className="ml-1" style={{ color: "#5ab28d" }}>
                                    {p.installment ?? "?"} → {p.nextInstallment}
                                  </span>
                                </span>
                                <span className="text-xs" style={{ color: "#8dcdb0" }}>{BRL(p.amount)}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setMigratePlan(null)}
                  className="px-3 py-2 rounded text-sm"
                  style={{ background: "#1c2b22", border: "1px solid #2a3d31", color: "#8dcdb0" }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeMigration}
                  className="px-3 py-2 rounded text-sm font-semibold"
                  style={{ background: "#389671", color: "#fff" }}
                >
                  Migrar (
                  {migratePlan.normal.filter((n) => selectedBills.has(n.bill.id)).length +
                    migratePlan.cards.filter(
                      (c) => (selectedParcelas[c.bill.id]?.size ?? 0) > 0,
                    ).length}
                  )
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "#8dcdb0" }}
          >
            <ChevronLeft size={20} />
          </button>
          <h2
            className="text-lg font-black min-w-40 text-center"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {MONTHS[month - 1]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "#8dcdb0" }}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prepareMigration}
            disabled={migrating || preparingMigration || bills.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "#1c2b22", color: "#8dcdb0", border: "1px solid #2a3d31" }}
          >
            <Copy size={15} />
            <span className="hidden sm:inline">
              {migrating ? "Migrando..." : preparingMigration ? "Preparando..." : "Migrar mês"}
            </span>
          </button>

          <button
            onClick={() => {
              setEditBill(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: "#389671", color: "#fff" }}
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Nova conta</span>
          </button>
        </div>
      </div>

      {/* v2: Ownership filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", "mine", "joint", "hers"] as OwnershipFilter[]).map((key) => {
          const cfg = OWNERSHIP_CONFIG[key];
          const isActive = ownershipFilter === key;
          const count =
            key === "all"
              ? bills.length
              : bills.filter((b) => b.ownership === key).length;
          return (
            <button
              key={key}
              onClick={() => setOwnershipFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0"
              style={{
                background: isActive ? cfg.activeBg : "#1c2b22",
                color: isActive ? "#fff" : cfg.color,
                border: `1px solid ${isActive ? cfg.activeBg : "#2a3d31"}`,
              }}
            >
              <span>{cfg.emoji}</span>
              {cfg.label}
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{
                  background: isActive ? "rgba(255,255,255,0.2)" : "#2a3d31",
                  color: isActive ? "#fff" : "#4a6b58",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card-elevated rounded-xl p-4">
          <div
            className="text-xs mb-1 uppercase tracking-wide"
            style={{ color: "#4a6b58" }}
          >
            {ownershipFilter === "all"
              ? "Total"
              : `Total ${OWNERSHIP_CONFIG[ownershipFilter].label}`}
          </div>
          <div
            className="text-lg font-bold font-numeric"
            style={{ color: "#f0f9f4" }}
          >
            {BRL(totalBills)}
          </div>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <div
            className="text-xs mb-1 uppercase tracking-wide"
            style={{ color: "#4a6b58" }}
          >
            Renda
          </div>
          <div
            className="text-lg font-bold font-numeric"
            style={{ color: "#5ab28d" }}
          >
            {BRL(totalIncome)}
          </div>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <div
            className="text-xs mb-1 uppercase tracking-wide"
            style={{ color: "#4a6b58" }}
          >
            Pendente
          </div>
          <div
            className="text-lg font-bold font-numeric"
            style={{ color: "#f59e0b" }}
          >
            {BRL(pendingBills)}
          </div>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <div
            className="text-xs mb-1 uppercase tracking-wide"
            style={{ color: "#4a6b58" }}
          >
            Saldo real
          </div>
          <div
            className="text-lg font-bold font-numeric"
            style={{ color: balance >= 0 ? "#5ab28d" : "#ef4444" }}
          >
            {BRL(balance)}
          </div>
        </div>
      </div>

      {/* v2: Category budgets */}
      <CategoryBudgets bills={bills} month={month} year={year} />

      {/* Salaries */}
      {salaries.length > 0 && (
        <div className="card p-4">
          <button
            onClick={() => setShowSalaries(true)}
            className="text-xs font-semibold mb-3 uppercase tracking-wide"
            style={{ color: "#4a6b58" }}
          >
            Salários
          </button>
          <div className="flex flex-wrap gap-3">
            {salaries.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "#8dcdb0" }}>
                  {s.person}:
                </span>
                <span
                  className="text-sm font-bold font-numeric"
                  style={{ color: "#5ab28d" }}
                >
                  {BRL(s.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bills list */}
      {loading ? (
        <div className="card p-8 text-center" style={{ color: "#4a6b58" }}>
          Carregando...
        </div>
      ) : filteredBills.length === 0 ? (
        <div className="card p-8 text-center space-y-3">
          <div className="text-3xl">📋</div>
          <p style={{ color: "#4a6b58" }}>
            {ownershipFilter === "all"
              ? `Nenhuma conta em ${MONTHS[month - 1]}`
              : `Nenhuma conta "${OWNERSHIP_CONFIG[ownershipFilter].label}" em ${MONTHS[month - 1]}`}
          </p>
          <button
            onClick={() => {
              setEditBill(null);
              setShowForm(true);
            }}
            className="text-sm font-medium underline"
            style={{ color: "#5ab28d" }}
          >
            Adicionar primeira conta
          </button>
        </div>
      ) : (
        <div className="card overflow-visible">
          <div className="divide-y" style={{ borderColor: "#2a3d31" }}>
            {filteredBills.map((bill) => {
              const dueSoon = isDueSoon(bill);
              const overdue = isOverdue(bill);
              const isCard = bill.type === "CARD";
              const isExpanded = expandedCardBills.includes(bill.id);
              const ownershipBadge = OWNERSHIP_BADGE[bill.ownership];

              return (
                <div key={bill.id}>
                  <div className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-white/[0.02]">
                    {/* Paid toggle */}
                    <button
                      onClick={() => togglePaid(bill)}
                      className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        borderColor: bill.isPaid ? "#389671" : "#2a3d31",
                        background: bill.isPaid ? "#389671" : "transparent",
                      }}
                    >
                      {bill.isPaid && (
                        <Check size={12} strokeWidth={3} color="#fff" />
                      )}
                    </button>

                    {/* Name & details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-sm font-medium truncate"
                          style={{
                            color: bill.isPaid ? "#4a6b58" : "#f0f9f4",
                            textDecoration: bill.isPaid
                              ? "line-through"
                              : "none",
                          }}
                        >
                          {bill.name}
                        </span>
                        {isCard && bill.cardLast4 && (
                          <span
                            className="text-xs"
                            style={{ color: "#4a6b58" }}
                          >
                            •••• {bill.cardLast4}
                          </span>
                        )}
                        {(dueSoon || overdue) && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${overdue ? "badge-overdue" : "badge-pending"}`}
                          >
                            {overdue
                              ? "Vencida"
                              : `Vence em ${bill.dueDay! - today}d`}
                          </span>
                        )}
                        {/* v2: ownership badge — exibido apenas na aba "Todas" */}
                        {ownershipFilter === "all" && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0"
                            style={{
                              color: ownershipBadge.color,
                              background: ownershipBadge.bg,
                            }}
                          >
                            {ownershipBadge.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isCard && bill.cardNickname && (
                          <span
                            className="text-xs"
                            style={{ color: "#5ab28d" }}
                          >
                            {bill.cardNickname}
                          </span>
                        )}
                        {bill.installment && (
                          <span
                            className="text-xs"
                            style={{ color: "#4a6b58" }}
                          >
                            {bill.installment}
                          </span>
                        )}
                        {bill.dueDay && (
                          <span
                            className="text-xs flex items-center gap-1"
                            style={{ color: "#4a6b58" }}
                          >
                            dia {bill.dueDay}
                          </span>
                        )}
                        {bill.date && (
                          <span
                            className="text-xs flex items-center gap-1 font-medium"
                            style={{ color: bill.isPaid ? "#5ab28d" : "#4a6b58" }}
                          >
                            {bill.isPaid ? "Pago em" : "Data"} {formatDateBR(bill.date)}
                          </span>
                        )}
                        {!isCard && bill.category && (
                          <span
                            className="text-xs"
                            style={{ color: "#4a6b58" }}
                          >
                            {bill.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <span
                      className="text-sm font-bold font-numeric flex-shrink-0 text-right w-28"
                      style={{ color: bill.isPaid ? "#4a6b58" : "#f0f9f4" }}
                    >
                      {BRL(bill.amount)}
                    </span>

                    {/* Expand for card bills */}
                    {isCard && (
                      <button
                        onClick={() => {
                          setExpandedCardBills((prev) =>
                            prev.includes(bill.id)
                              ? prev.filter((id) => id !== bill.id)
                              : [...prev, bill.id],
                          );
                        }}
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                        style={{ color: "#8dcdb0" }}
                      >
                        {isExpanded ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>
                    )}

                    {/* Actions */}
                    <BillsMobileActions
                      bill={bill}
                      att={parseAttachments((bill as any).attachments)}
                      onEdit={() => {
                        setEditBill(bill);
                        setShowForm(true);
                      }}
                      onDelete={() => deleteBill(bill.id)}
                      onUpload={handleUpload}
                      onDeleteAttachment={handleDeleteAttachment}
                    />
                  </div>

                  {/* Card transactions (expandable) */}
                  {isCard && isExpanded && (
                    <div
                      className="px-4 pb-3 ml-9"
                      style={{ background: "#0f1a15" }}
                    >
                      <CardBillTransactions
                        billId={bill.id}
                        onTotalChange={(newTotal) => {
                          setBills((prev) =>
                            prev.map((b) =>
                              b.id === bill.id ? { ...b, amount: newTotal } : b,
                            ),
                          );
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer total */}
          <div
            className="px-4 py-3 flex justify-between items-center"
            style={{ background: "#1c2b22", borderTop: "1px solid #2a3d31" }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: "#8dcdb0" }}
            >
              Total ({filteredBills.filter((b) => b.isPaid).length}/
              {filteredBills.length} pagos)
            </span>
            <span
              className="text-sm font-bold font-numeric"
              style={{ color: "#f0f9f4" }}
            >
              {BRL(totalBills)}
            </span>
          </div>
        </div>
      )}

      {/* Cartões alimentação — controle isolado, não afeta renda/contas */}
      <MealCardsManager month={month} year={year} />

      {/* Bill Form Modal */}
      {showForm && (
        <BillForm
          bill={editBill}
          month={month}
          year={year}
          onClose={() => {
            setShowForm(false);
            setEditBill(null);
          }}
          onSave={() => {
            setShowForm(false);
            setEditBill(null);
            fetchData();
          }}
        />
      )}

      {/* Salaries Modal */}
      {showSalaries && (
        <ModalPortal>
          <button
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setShowSalaries(false)}
          />
          <div className="fixed inset-0 z-50 flex justify-center p-4 items-end sm:items-center">
            <div className="w-full sm:max-w-2xl max-h-[90vh] overflow-auto">
              <div className="card p-4">
                <SalariesManager
                  month={month}
                  year={year}
                  onClose={() => setShowSalaries(false)}
                  onSave={() => {
                    setShowSalaries(false);
                    fetchData();
                  }}
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
