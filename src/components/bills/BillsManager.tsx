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
import SalariesManager from "@/components/salaries/SalariesManager";
import BillForm from "./BillForm";
import BillsMobileActions from "./BillsMobileActions";
import CardBillTransactions from "./CardBillTransactions";
import CategoryBudgets from "./CategoryBudgets";
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
  amount: number;
  installment?: string | null;
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

  async function migrateBillsToNextMonth() {
    if (bills.length === 0) {
      showToast("Sem contas para migrar neste mês.");
      return;
    }

    const { nextMonth, nextYear } = getNextMonthYear(month, year);
    const ok = await showConfirm(
      `Migrar ${bills.length} conta(s) para ${MONTHS[nextMonth - 1]}/${nextYear}? As parcelas serão avançadas em +1 quando aplicável.`,
    );
    if (!ok) return;

    setMigrating(true);
    try {
      const existingRes = await fetch(`/api/bills?month=${nextMonth}&year=${nextYear}`);
      if (!existingRes.ok) throw new Error("Erro ao buscar contas do próximo mês");
      const existingNextMonthBills: Bill[] = await existingRes.json();

      const existingByName = new Map(
        existingNextMonthBills.map((b) => [b.name.trim().toLowerCase(), b]),
      );

      const nextBills = await Promise.all(
        bills.map(async (bill) => {
          if (bill.type === "CARD") {
            const txRes = await fetch(`/api/bills/${bill.id}/transactions`);
            if (!txRes.ok) return null;

            const transactions: CardTransaction[] = await txRes.json();
            const nextInstallments = transactions
              .map((tx) => ({
                amount: tx.amount,
                nextInstallment: incrementStrictInstallment(tx.installment),
              }))
              .filter((tx) => tx.nextInstallment !== null);

            if (nextInstallments.length === 0) return null;

            const nextAmount = nextInstallments.reduce((sum, tx) => sum + tx.amount, 0);

            return {
              name: bill.name,
              amount: nextAmount,
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
            };
          }

          const nextInstallment = incrementInstallment(bill.installment);
          if (bill.installment && !nextInstallment) return null;

          return {
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
          };
        }),
      );

      const validNextBills = nextBills.filter((bill) => bill !== null);

      const mergedByName = new Map<string, (typeof validNextBills)[number]>();
      for (const payload of validNextBills) {
        const key = payload.name.trim().toLowerCase();
        const existing = mergedByName.get(key);
        if (existing) {
          mergedByName.set(key, { ...existing, amount: existing.amount + payload.amount });
        } else {
          mergedByName.set(key, payload);
        }
      }
      const mergedNextBills = Array.from(mergedByName.values());

      if (mergedNextBills.length === 0) {
        showToast("Nenhuma conta elegível para migração.");
        return;
      }

      const responses = await Promise.all(mergedNextBills.map(async (payload) => {
        const key = payload.name.trim().toLowerCase();
        const existing = existingByName.get(key);

        if (existing) {
          return fetch(`/api/bills/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: payload.amount }),
          });
        }

        return fetch("/api/bills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }));

      if (responses.some((res) => !res.ok)) {
        throw new Error("Erro ao migrar contas");
      }

      showToast(
        `${mergedNextBills.length} conta(s) migrada(s) para ${MONTHS[nextMonth - 1]}/${nextYear}.`,
      );
    } catch {
      showToast("Não foi possível migrar as contas. Tente novamente.");
    } finally {
      setMigrating(false);
    }
  }

  async function togglePaid(bill: Bill) {
    await fetch(`/api/bills/${bill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid: !bill.isPaid }),
    });
    setBills((prev) =>
      prev.map((b) => (b.id === bill.id ? { ...b, isPaid: !b.isPaid } : b)),
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
            onClick={migrateBillsToNextMonth}
            disabled={migrating || bills.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "#1c2b22", color: "#8dcdb0", border: "1px solid #2a3d31" }}
          >
            <Copy size={15} />
            <span className="hidden sm:inline">{migrating ? "Migrando..." : "Migrar mês"}</span>
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
        <>
          <button
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setShowSalaries(false)}
          />
          <div className="fixed inset-0 z-50 flex justify-center p-4 items-end sm:items-start">
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
        </>
      )}
    </div>
  );
}
