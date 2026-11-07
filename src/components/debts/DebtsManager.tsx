"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// ── Tipos ────────────────────────────────────────────────────

interface Bill {
  id: number;
  name: string;
  amount: number;
  month: number;
  year: number;
  isPaid: boolean;
  installment?: string | null;
  category?: string | null;
  linked?: boolean;
  linkId?: number;
}

interface HistoryEntry {
  id: number;
  previousAmount: number;
  newAmount: number;
  reason?: string | null;
  changedAt?: string | null;
  linkedBill?: {
    id: number;
    name: string;
    amount: number;
    month: number;
    year: number;
    installment?: string | null;
  } | null;
  linkedBills?: Array<{
    id: number;
    name: string;
    amount: number;
    month: number;
    year: number;
    installment?: string | null;
  }>;
}

interface Debt {
  id?: number;
  name: string;
  amount: number; // valor atual da dívida
  paidAmount?: number; // soma histórica de todas as bills vinculadas
  paidPartial?: number; // soma das bills vinculadas no mês selecionado
  isPaid?: boolean;
  notes?: string | null;
  linkedBills?: Bill[];
}

// ── Helpers ──────────────────────────────────────────────────

const BRL = (v = 0) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

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

// ── Componente ───────────────────────────────────────────────

interface Props {
  /** Mês selecionado globalmente no app (1-12) */
  selectedMonth?: number;
  /** Ano selecionado globalmente no app */
  selectedYear?: number;
}

function getNextMonthYear(date: Date) {
  const month = date.getMonth() + 1;
  return month === 12
    ? { month: 1, year: date.getFullYear() + 1 }
    : { month: month + 1, year: date.getFullYear() };
}

export default function DebtsManager({
  selectedMonth,
  selectedYear,
}: Readonly<Props>) {
  const defaultPeriod = getNextMonthYear(new Date());
  const month = selectedMonth ?? defaultPeriod.month;
  const year = selectedYear ?? defaultPeriod.year;
  const [items, setItems] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal criar/editar
  const [editing, setEditing] = useState<Debt | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState("");

  // Modal detalhes (abas)
  const [detailDebt, setDetailDebt] = useState<Debt | null>(null);
  const [activeTab, setActiveTab] = useState<"history" | "bills">("history");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [billsAvailable, setBillsAvailable] = useState<Bill[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form de novo histórico
  const [historyAmount, setHistoryAmount] = useState(0);
  const [historyReason, setHistoryReason] = useState("");
  const [createBillFromHistory, setCreateBillFromHistory] = useState(false);
  const [historyBillName, setHistoryBillName] = useState("");
  const [historyBillAmount, setHistoryBillAmount] = useState(0);
  const [historyBillMonth, setHistoryBillMonth] = useState(month);
  const [historyBillYear, setHistoryBillYear] = useState(year);
  const [historyBillPaymentType, setHistoryBillPaymentType] = useState<"AVISTA" | "PARCELADA">("AVISTA");
  const [historyBillInstallments, setHistoryBillInstallments] = useState(2);
  const [historySubmitting, setHistorySubmitting] = useState(false);

  // Modal confirmar exclusão
  const [showDelete, setShowDelete] = useState<Debt | null>(null);

  // ── Fetch ─────────────────────────────────────────────────

  async function fetchData() {
    setLoading(true);
    const res = await fetch(
      `/api/debts?month=${month}&year=${year}`,
    );
    setItems(res.ok ? await res.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [month, year]);

  async function fetchHistory(debtId: number) {
    setDetailLoading(true);
    const res = await fetch(`/api/history-debts?debtId=${debtId}`);
    setHistory(res.ok ? await res.json() : []);
    setDetailLoading(false);
  }

  async function fetchBills(debtId: number) {
    setDetailLoading(true);
    const res = await fetch(
      `/api/debt-bill-links?debtId=${debtId}&month=${month}&year=${year}`,
    );
    setBillsAvailable(res.ok ? await res.json() : []);
    setDetailLoading(false);
  }

  // ── Modal detalhes ────────────────────────────────────────

  function openDetail(debt: Debt, tab: "history" | "bills" = "history") {
    setDetailDebt(debt);
    setActiveTab(tab);
    setHistoryAmount(debt.amount ?? 0);
    setHistoryReason("");
    setCreateBillFromHistory(false);
    setHistoryBillName(`Pagamento dívida - ${debt.name}`);
    setHistoryBillAmount(debt.amount ?? 0);
    setHistoryBillMonth(month);
    setHistoryBillYear(year);
    setHistoryBillPaymentType("AVISTA");
    setHistoryBillInstallments(2);
    if (tab === "history") fetchHistory(debt.id!);
    else fetchBills(debt.id!);
  }

  function switchTab(tab: "history" | "bills") {
    setActiveTab(tab);
    if (!detailDebt?.id) return;
    if (tab === "history") fetchHistory(detailDebt.id);
    else fetchBills(detailDebt.id);
  }

  // ── Vincular / desvincular bill ───────────────────────────

  async function toggleLink(bill: Bill) {
    if (!detailDebt?.id) return;
    if (bill.linked && bill.linkId) {
      await fetch(`/api/debt-bill-links?id=${bill.linkId}`, {
        method: "DELETE",
      });
    } else {
      await fetch(`/api/debt-bill-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debtId: detailDebt.id, billId: bill.id }),
      });
    }
    fetchBills(detailDebt.id);
    fetchData();
  }

  async function submitHistory(e: React.FormEvent) {
    e.preventDefault();
    if (!detailDebt?.id) return;

    setHistorySubmitting(true);
    const res = await fetch("/api/history-debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        debtId: detailDebt.id,
        newAmount: historyAmount,
        reason: historyReason || "Renegociação manual",
        createBill: createBillFromHistory,
        billName: historyBillName,
        billAmount: historyBillAmount,
        billMonth: historyBillMonth,
        billYear: historyBillYear,
        billPaymentType: historyBillPaymentType,
        billInstallments: historyBillInstallments,
      }),
    });

    if (res.ok) {
      await fetchData();
      await fetchHistory(detailDebt.id);

      // Mantém o cabeçalho do modal sincronizado com o novo valor da dívida
      setDetailDebt({ ...detailDebt, amount: historyAmount });

      // Mantém defaults úteis para a próxima entrada
      setHistoryReason("");
      setHistoryBillAmount(historyAmount);
    }

    setHistorySubmitting(false);
  }

  // ── CRUD dívidas ──────────────────────────────────────────

  function openNew() {
    setEditing({ name: "", amount: 0, isPaid: false });
    setReason("");
    setShowModal(true);
  }

  function openEdit(debt: Debt) {
    setEditing(debt);
    setReason("");
    setShowModal(true);
  }

  async function submitModal(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);

    const payload = {
      id: editing.id,
      name: String(fd.get("name") || "").trim(),
      amount: Number.parseFloat(String(fd.get("amount") || "0")) || 0,
      notes: String(fd.get("notes") || "") || null,
      isPaid: !!fd.get("isPaid"),
      reason: reason || "Renegociação",
    };

    if (payload.id) {
      await fetch(`/api/debts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`/api/debts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setShowModal(false);
    setEditing(null);
    fetchData();
  }

  async function doDelete(debt: Debt | null) {
    if (!debt?.id) return;
    await fetch(`/api/debts?id=${debt.id}`, { method: "DELETE" });
    setShowDelete(null);
    fetchData();
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) return <div className="card p-4">Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black">Dívidas</h3>
        <button
          onClick={openNew}
          className="px-3 py-2 rounded-md text-sm"
          style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
        >
          Adicionar
        </button>
      </div>

      {/* Tabela */}
      <div className="card p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "rgb(var(--text-muted))" }}>
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Valor da dívida</th>
              <th className="text-left p-2">Pago total</th>
              <th className="text-left p-2">
                Pago em {MONTHS[month - 1].slice(0, 3)}/
                {String(year).slice(2)}
              </th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-4 text-center"
                  style={{ color: "rgb(var(--text-muted))" }}
                >
                  Nenhuma dívida cadastrada.
                </td>
              </tr>
            )}
            {items.map((debt) => {
              const remaining = (debt.amount ?? 0) - (debt.paidAmount ?? 0);
              return (
                <tr
                  key={debt.id}
                  className="border-t"
                  style={{ borderColor: "rgb(var(--border))" }}
                >
                  <td className="p-2" style={{ color: "rgb(var(--text))" }}>
                    {debt.name}
                  </td>
                  <td className="p-2" style={{ color: "rgb(var(--text))" }}>
                    {BRL(debt.amount)}
                  </td>
                  <td className="p-2">
                    <span style={{ color: "rgb(var(--accent))" }}>
                      {BRL(debt.paidAmount)}
                    </span>
                    {remaining > 0 && (
                      <span
                        className="text-xs ml-1"
                        style={{ color: "rgb(var(--text-muted))" }}
                      >
                        (faltam {BRL(remaining)})
                      </span>
                    )}
                  </td>
                  <td
                    className="p-2"
                    style={{ color: debt.paidPartial ? "rgb(var(--accent))" : "rgb(var(--text-muted))" }}
                  >
                    {debt.paidPartial ? BRL(debt.paidPartial) : "—"}
                  </td>
                  <td className="p-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: debt.isPaid ? "rgb(var(--accent-bg))" : "rgb(var(--negative-bg))",
                        color: debt.isPaid ? "rgb(var(--accent))" : "rgb(var(--negative-soft))",
                      }}
                    >
                      {debt.isPaid ? "Pago" : "Pendente"}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => openDetail(debt, "history")}
                        className="px-2 py-1 rounded-md text-xs"
                        style={{ background: "rgb(var(--surface-raised))", color: "rgb(var(--text-soft))" }}
                      >
                        Histórico
                      </button>
                      <button
                        onClick={() => openDetail(debt, "bills")}
                        className="px-2 py-1 rounded-md text-xs"
                        style={{ background: "rgb(var(--surface-raised))", color: "rgb(var(--text-soft))" }}
                      >
                        Vincular bill
                      </button>
                      <button
                        onClick={() => openEdit(debt)}
                        className="px-2 py-1 rounded-md text-xs"
                        style={{ background: "rgb(var(--surface-raised))", color: "rgb(var(--text-soft))" }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setShowDelete(debt)}
                        className="px-2 py-1 rounded-md text-xs"
                        style={{ background: "rgb(var(--border))", color: "rgb(var(--negative-soft))" }}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal criar/editar ── */}
      {showModal &&
        editing &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-40"
              style={{
                background: "rgba(0,0,0,0.7)",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
              onClick={() => {
                setShowModal(false);
                setEditing(null);
              }}
            />
            <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-auto">
              <form
                onSubmit={submitModal}
                className="card p-6 w-full sm:max-w-lg space-y-4 max-h-[90vh] overflow-auto mt-10 sm:mt-0"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base font-black">
                  {editing.id ? "Editar dívida" : "Nova dívida"}
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "rgb(var(--text-soft))" }}
                    >
                      Nome
                    </label>
                    <input
                      name="name"
                      defaultValue={editing.name}
                      required
                      className="input-base w-full"
                      placeholder="Ex: Empréstimo banco, cartão XYZ…"
                    />
                  </div>

                  <div className="col-span-2">
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "rgb(var(--text-soft))" }}
                    >
                      Valor da dívida
                    </label>
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editing.amount ?? 0}
                      required
                      className="input-base w-full"
                      placeholder="0,00"
                    />
                    {editing.id && (
                      <p className="text-xs mt-1" style={{ color: "rgb(var(--text-muted))" }}>
                        Se o valor mudou, a alteração será registrada no
                        histórico de renegociações.
                      </p>
                    )}
                  </div>

                  {editing.id && (
                    <div className="col-span-2">
                      <label
                        className="block text-xs mb-1"
                        style={{ color: "rgb(var(--text-soft))" }}
                      >
                        Motivo da alteração
                      </label>
                      <input
                        className="input-base w-full"
                        placeholder="Ex: Negociação com banco, juros adicionados…"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="col-span-2">
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "rgb(var(--text-soft))" }}
                    >
                      Observações
                    </label>
                    <textarea
                      name="notes"
                      defaultValue={editing.notes ?? ""}
                      className="input-base w-full"
                      placeholder="Opcional"
                    />
                  </div>

                  <div className="col-span-2 flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer"
                      style={{
                        borderColor: editing.isPaid ? "rgb(var(--accent-strong))" : "rgb(var(--border))",
                        background: editing.isPaid ? "rgb(var(--accent-strong))" : "transparent",
                      }}
                      onClick={() =>
                        setEditing({ ...editing, isPaid: !editing.isPaid })
                      }
                    >
                      {editing.isPaid && (
                        <svg width={12} height={12} viewBox="0 0 12 12">
                          <polyline
                            points="2,7 5,10 10,3"
                            fill="none"
                            stroke="rgb(var(--on-accent))"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm" style={{ color: "rgb(var(--text-soft))" }}>
                      Marcar como pago
                    </span>
                    <input
                      type="hidden"
                      name="isPaid"
                      value={editing.isPaid ? "on" : ""}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditing(null);
                    }}
                    className="px-4 py-2 rounded-md"
                    style={{ background: "rgb(var(--surface-raised))", color: "rgb(var(--text-soft))" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-md"
                    style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </>,
          document.body,
        )}

      {/* ── Modal detalhes (abas: Histórico | Bills) ── */}
      {detailDebt &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-40"
              style={{
                background: "rgba(0,0,0,0.7)",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
              onClick={() => setDetailDebt(null)}
            />
            <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-auto">
              <div
                className="card p-6 w-full sm:max-w-xl space-y-4 max-h-[90vh] overflow-auto mt-10 sm:mt-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Cabeçalho */}
                <div>
                  <h3 className="text-base font-black">{detailDebt.name}</h3>
                  <div
                    className="flex gap-4 mt-1 text-xs"
                    style={{ color: "rgb(var(--text-muted))" }}
                  >
                    <span>
                      Dívida:{" "}
                      <strong style={{ color: "rgb(var(--text))" }}>
                        {BRL(detailDebt.amount)}
                      </strong>
                    </span>
                    <span>
                      Pago total:{" "}
                      <strong style={{ color: "rgb(var(--accent))" }}>
                        {BRL(detailDebt.paidAmount)}
                      </strong>
                    </span>
                    <span>
                      Pago em {MONTHS[month - 1].slice(0, 3)}/
                      {String(year).slice(2)}:{" "}
                      <strong
                        style={{
                          color: detailDebt.paidPartial ? "rgb(var(--accent))" : "rgb(var(--text-muted))",
                        }}
                      >
                        {detailDebt.paidPartial
                          ? BRL(detailDebt.paidPartial)
                          : "—"}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Abas */}
                <div
                  className="flex gap-2 border-b"
                  style={{ borderColor: "rgb(var(--border))" }}
                >
                  {(["history", "bills"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => switchTab(tab)}
                      className="pb-2 px-1 text-sm font-semibold transition-colors"
                      style={{
                        borderBottom:
                          activeTab === tab
                            ? "2px solid rgb(var(--accent-strong))"
                            : "2px solid transparent",
                        color: activeTab === tab ? "rgb(var(--accent))" : "rgb(var(--text-muted))",
                      }}
                    >
                      {tab === "history"
                        ? "Renegociações"
                        : `Bills — ${MONTHS[month - 1]} ${year}`}
                    </button>
                  ))}
                </div>

                {/* Conteúdo da aba */}
                {detailLoading ? (
                  <p className="text-sm" style={{ color: "rgb(var(--text-muted))" }}>
                    Carregando...
                  </p>
                ) : activeTab === "history" ? (
                  // ── Aba Histórico de renegociações ──
                  <div className="space-y-4">
                    <form
                      onSubmit={submitHistory}
                      className="p-3 rounded-lg border space-y-3"
                      style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--bg))" }}
                    >
                      <h4 className="text-sm font-bold" style={{ color: "rgb(var(--text-soft))" }}>
                        Nova renegociação
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "rgb(var(--text-soft))" }}>
                            Novo valor da dívida
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input-base w-full"
                            value={historyAmount}
                            onChange={(e) => setHistoryAmount(Number(e.target.value) || 0)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "rgb(var(--text-soft))" }}>
                            Motivo
                          </label>
                          <input
                            className="input-base w-full"
                            value={historyReason}
                            onChange={(e) => setHistoryReason(e.target.value)}
                            placeholder="Ex: Parcela renegociada"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          id="createBillFromHistory"
                          type="checkbox"
                          checked={createBillFromHistory}
                          onChange={(e) => setCreateBillFromHistory(e.target.checked)}
                        />
                        <label htmlFor="createBillFromHistory" className="text-sm" style={{ color: "rgb(var(--text-soft))" }}>
                          Criar nova conta (bill) a partir deste histórico
                        </label>
                      </div>

                      {createBillFromHistory && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="block text-xs mb-1" style={{ color: "rgb(var(--text-soft))" }}>
                              Nome da conta
                            </label>
                            <input
                              className="input-base w-full"
                              value={historyBillName}
                              onChange={(e) => setHistoryBillName(e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: "rgb(var(--text-soft))" }}>
                              Valor da conta
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="input-base w-full"
                              value={historyBillAmount}
                              onChange={(e) => setHistoryBillAmount(Number(e.target.value) || 0)}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: "rgb(var(--text-soft))" }}>
                              Mês
                            </label>
                            <select
                              className="input-base w-full"
                              value={historyBillMonth}
                              onChange={(e) => setHistoryBillMonth(Number(e.target.value) || month)}
                            >
                              {MONTHS.map((m, idx) => (
                                <option key={m} value={idx + 1}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: "rgb(var(--text-soft))" }}>
                              Ano
                            </label>
                            <input
                              type="number"
                              className="input-base w-full"
                              value={historyBillYear}
                              onChange={(e) => setHistoryBillYear(Number(e.target.value) || year)}
                              min={2000}
                              max={2100}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: "rgb(var(--text-soft))" }}>
                              Tipo de pagamento
                            </label>
                            <select
                              className="input-base w-full"
                              value={historyBillPaymentType}
                              onChange={(e) => {
                                const next = e.target.value === "PARCELADA" ? "PARCELADA" : "AVISTA";
                                setHistoryBillPaymentType(next);
                              }}
                            >
                              <option value="AVISTA">A vista</option>
                              <option value="PARCELADA">Parcelada</option>
                            </select>
                          </div>
                          {historyBillPaymentType === "PARCELADA" && (
                            <div>
                              <label className="block text-xs mb-1" style={{ color: "rgb(var(--text-soft))" }}>
                                Quantidade de parcelas
                              </label>
                              <input
                                type="number"
                                className="input-base w-full"
                                value={historyBillInstallments}
                                onChange={(e) => setHistoryBillInstallments(Math.max(2, Number(e.target.value) || 2))}
                                min={2}
                                max={120}
                                required
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={historySubmitting}
                          className="px-3 py-2 rounded-md text-sm"
                          style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))", opacity: historySubmitting ? 0.7 : 1 }}
                        >
                          {historySubmitting ? "Salvando..." : "Salvar histórico"}
                        </button>
                      </div>
                    </form>

                    {history.length === 0 ? (
                      <p className="text-sm" style={{ color: "rgb(var(--text-muted))" }}>
                        Nenhuma renegociação registrada.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ color: "rgb(var(--text-muted))" }}>
                            <th className="text-left p-2">Data</th>
                            <th className="text-left p-2">De</th>
                            <th className="text-left p-2">Para</th>
                            <th className="text-left p-2">Motivo</th>
                            <th className="text-left p-2">Conta gerada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((h) => (
                            <tr
                              key={h.id}
                              className="border-t"
                              style={{ borderColor: "rgb(var(--border))" }}
                            >
                              <td className="p-2" style={{ color: "rgb(var(--text-muted))" }}>
                                {h.changedAt
                                  ? new Date(h.changedAt).toLocaleDateString("pt-BR")
                                  : "—"}
                              </td>
                              <td className="p-2" style={{ color: "rgb(var(--negative-soft))" }}>
                                {BRL(h.previousAmount)}
                              </td>
                              <td className="p-2" style={{ color: "rgb(var(--accent))" }}>
                                {BRL(h.newAmount)}
                              </td>
                              <td className="p-2" style={{ color: "rgb(var(--text-soft))" }}>
                                {h.reason || "—"}
                              </td>
                              <td className="p-2" style={{ color: "rgb(var(--text-soft))" }}>
                                {h.linkedBills && h.linkedBills.length > 0
                                  ? h.linkedBills
                                      .map(
                                        (b) =>
                                          `${MONTHS[b.month - 1]}/${b.year}${b.installment ? " " + b.installment : ""} (${BRL(b.amount)})`,
                                      )
                                      .join(" | ")
                                  : h.linkedBill
                                    ? `${h.linkedBill.name} (${MONTHS[h.linkedBill.month - 1]}/${h.linkedBill.year})${h.linkedBill.installment ? " - " + h.linkedBill.installment : ""}`
                                    : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : // ── Aba Bills do mês ──
                billsAvailable.length === 0 ? (
                  <p className="text-sm" style={{ color: "rgb(var(--text-muted))" }}>
                    Nenhuma bill encontrada para {MONTHS[month - 1]}{" "}
                    {year}.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ color: "rgb(var(--text-muted))" }}>
                        <th className="text-left p-2">Bill</th>
                        <th className="text-left p-2">Valor</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Vínculo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billsAvailable.map((bill) => (
                        <tr
                          key={bill.id}
                          className="border-t"
                          style={{ borderColor: "rgb(var(--border))" }}
                        >
                          <td className="p-2" style={{ color: "rgb(var(--text))" }}>
                            {bill.name}
                          </td>
                          <td className="p-2" style={{ color: "rgb(var(--accent))" }}>
                            {BRL(bill.amount)}
                          </td>
                          <td className="p-2">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: bill.isPaid ? "rgb(var(--accent-bg))" : "rgb(var(--negative-bg))",
                                color: bill.isPaid ? "rgb(var(--accent))" : "rgb(var(--negative-soft))",
                              }}
                            >
                              {bill.isPaid ? "Pago" : "Pendente"}
                            </span>
                          </td>
                          <td className="p-2">
                            <button
                              onClick={() => toggleLink(bill)}
                              className="px-2 py-1 rounded-md text-xs"
                              style={{
                                background: bill.linked ? "rgb(var(--negative-bg))" : "rgb(var(--accent-bg))",
                                color: bill.linked ? "rgb(var(--negative-soft))" : "rgb(var(--accent))",
                              }}
                            >
                              {bill.linked ? "Desvincular" : "Vincular"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={() => setDetailDebt(null)}
                    className="px-4 py-2 rounded-md"
                    style={{ background: "rgb(var(--surface-raised))", color: "rgb(var(--text-soft))" }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}

      {/* ── Modal confirmar exclusão ── */}
      {showDelete &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.7)" }}
              onClick={() => setShowDelete(null)}
            />
            <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-auto">
              <div className="card p-6 w-full sm:max-w-md mt-10 sm:mt-0">
                <h3 className="text-base font-black">Confirmar exclusão</h3>
                <p className="mt-2" style={{ color: "rgb(var(--text-muted))" }}>
                  Remover &quot;{showDelete.name}&quot;? O histórico de renegociações e os
                  vínculos com bills também serão excluídos.
                </p>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowDelete(null)}
                    className="px-4 py-2 rounded-md"
                    style={{ background: "rgb(var(--surface-raised))", color: "rgb(var(--text-soft))" }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => doDelete(showDelete)}
                    className="px-4 py-2 rounded-md"
                    style={{ background: "rgb(var(--negative))", color: "rgb(var(--on-accent))" }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
