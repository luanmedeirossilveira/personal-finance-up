"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Check,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Receipt,
  X,
  Copy,
  QrCode,
} from "lucide-react";
import showToast from "@/components/ui/toast";
import showConfirm from "@/components/ui/confirm";
import SalariesManager from "@/components/salaries/SalariesManager";
import BillForm from "./BillForm";

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
  notes?: string;
  barCode?: string | null;
  qrCode?: string | null;
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

export default function BillsManager() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const now = new Date();
  const [month, setMonth] = useState(
    parseInt(searchParams.get("month") || String(now.getMonth() + 1)),
  );
  const [year, setYear] = useState(
    parseInt(searchParams.get("year") || String(now.getFullYear())),
  );

  const [bills, setBills] = useState<Bill[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [showSalaries, setShowSalaries] = useState(false);

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

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const pendingBills = bills
    .filter((b) => !b.isPaid)
    .reduce((s, b) => s + b.amount, 0);
  const totalIncome = salaries.reduce((s, sal) => s + sal.amount, 0);
  const balance = totalIncome - totalBills;

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

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card-elevated rounded-xl p-4">
          <div
            className="text-xs mb-1 uppercase tracking-wide"
            style={{ color: "#4a6b58" }}
          >
            Total
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
            Saldo
          </div>
          <div
            className="text-lg font-bold font-numeric"
            style={{ color: balance >= 0 ? "#5ab28d" : "#ef4444" }}
          >
            {BRL(balance)}
          </div>
        </div>
      </div>

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
      ) : bills.length === 0 ? (
        <div className="card p-8 text-center space-y-3">
          <div className="text-3xl">📋</div>
          <p style={{ color: "#4a6b58" }}>
            Nenhuma conta em {MONTHS[month - 1]}
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
        <div className="card overflow-hidden">
          <div className="divide-y" style={{ borderColor: "#2a3d31" }}>
            {bills.map((bill) => {
              const dueSoon = isDueSoon(bill);
              const overdue = isOverdue(bill);
              return (
                <div
                  key={bill.id}
                  className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-white/[0.02]"
                >
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
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium truncate"
                        style={{
                          color: bill.isPaid ? "#4a6b58" : "#f0f9f4",
                          textDecoration: bill.isPaid ? "line-through" : "none",
                        }}
                      >
                        {bill.name}
                      </span>
                      {(dueSoon || overdue) && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${overdue ? "badge-overdue" : "badge-pending"}`}
                        >
                          {overdue
                            ? "Vencida"
                            : `Vence em ${bill.dueDay! - today}d`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {bill.installment && (
                        <span className="text-xs" style={{ color: "#4a6b58" }}>
                          {bill.installment}
                        </span>
                      )}
                      {bill.dueDay && (
                        <span className="text-xs" style={{ color: "#4a6b58" }}>
                          dia {bill.dueDay}
                        </span>
                      )}
                      {bill.category && (
                        <span className="text-xs" style={{ color: "#4a6b58" }}>
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

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Fatura */}
                    {(() => {
                      const att = parseAttachments((bill as any).attachments);
                      return (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Fatura */}
                          <div className="relative group">
                            {att.fatura ? (
                              <div className="flex items-center">
                                <a
                                  href={att.fatura.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="py-1 rounded-md w-8 h-8 flex items-center justify-center transition-colors"
                                  title="Ver fatura"
                                  style={{ color: "#5ab28d" }}
                                >
                                  <FileText size={14} />
                                </a>
                                <button
                                  onClick={() =>
                                    handleDeleteAttachment(bill.id, "fatura")
                                  }
                                  className="py-1 rounded-md w-8 h-8 flex items-center justify-center transition-colors"
                                  style={{ color: "#4a6b58" }}
                                  title="Remover fatura"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <label
                                className="p-1 rounded-md w-8 h-8 flex items-center justify-center transition-colors cursor-pointer"
                                title="Anexar fatura"
                                style={{ color: "#4a6b58" }}
                              >
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) =>
                                    handleUpload(
                                      bill.id,
                                      "fatura",
                                      e.target.files?.[0],
                                    )
                                  }
                                />
                                <FileText size={14} />
                              </label>
                            )}
                          </div>
                          {/* Bar/QR buttons */}
                          {bill.barCode && (
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(bill.barCode!);
                                  showToast("Código de barras copiado");
                                } catch {
                                  showToast("Falha ao copiar código de barras");
                                }
                              }}
                              className="p-1 rounded-md w-8 h-8 flex items-center justify-center transition-colors"
                              style={{ color: "#4a6b58" }}
                              title="Copiar código de barras"
                            >
                              <Copy size={14} />
                            </button>
                          )}
                          {bill.qrCode && (
                            <button
                              onClick={async () => {
                                const v = bill.qrCode!;
                                if (v.startsWith("http://") || v.startsWith("https://")) {
                                  window.open(v, "_blank", "noopener,noreferrer");
                                  return;
                                }
                                try {
                                  await navigator.clipboard.writeText(v);
                                  showToast("QR copiado");
                                } catch {
                                  showToast("Falha ao copiar QR");
                                }
                              }}
                              className="p-1 rounded-md w-8 h-8 flex items-center justify-center transition-colors"
                              style={{ color: "#4a6b58" }}
                              title="Abrir/ copiar QR"
                            >
                              <QrCode size={14} />
                            </button>
                          )}

                          {/* Comprovante */}
                          <div className="relative group">
                            {att.comprovante ? (
                              <div className="flex items-center">
                                <a
                                  href={att.comprovante.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded-md w-8 h-8 flex items-center justify-center transition-colors"
                                  title="Ver comprovante"
                                  style={{ color: "#5ab28d" }}
                                >
                                  <Receipt size={14} />
                                </a>
                                <button
                                  onClick={() =>
                                    handleDeleteAttachment(
                                      bill.id,
                                      "comprovante",
                                    )
                                  }
                                  className="p-1 rounded-md w-8 h-8 flex items-center justify-center transition-colors"
                                  style={{ color: "#4a6b58" }}
                                  title="Remover comprovante"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <label
                                className="p-1 rounded-md w-8 h-8 flex items-center justify-center transition-colors cursor-pointer"
                                title="Anexar comprovante"
                                style={{ color: "#4a6b58" }}
                              >
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) =>
                                    handleUpload(
                                      bill.id,
                                      "comprovante",
                                      e.target.files?.[0],
                                    )
                                  }
                                />
                                <Receipt size={14} />
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    <button
                      onClick={() => {
                        setEditBill(bill);
                        setShowForm(true);
                      }}
                      className="p-1 rounded-md w-8 h-8 flex items-center justify-center transition-colors"
                      style={{ color: "#4a6b58" }}
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteBill(bill.id)}
                      className="p-1 rounded-md w-8 h-8 flex items-center justify-center transition-colors hover:bg-red-500/10"
                      style={{ color: "#4a6b58" }}
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
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
              Total ({bills.filter((b) => b.isPaid).length}/{bills.length}{" "}
              pagos)
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
