"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Check, Pencil, Trash2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import SalariesManager from "@/components/salaries/SalariesManager";

interface Bill {
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
}

interface Salary {
  id: number;
  person: string;
  amount: number;
}

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const CATEGORIES = ["moradia","transporte","saude","lazer","investimentos","alimentação","outros"];
const BRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function BillsManager() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const now = new Date();
  const [month, setMonth] = useState(parseInt(searchParams.get("month") || String(now.getMonth() + 1)));
  const [year, setYear] = useState(parseInt(searchParams.get("year") || String(now.getFullYear())));

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

  useEffect(() => { fetchData(); }, [fetchData]);

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
    setBills((prev) => prev.map((b) => b.id === bill.id ? { ...b, isPaid: !b.isPaid } : b));
  }

  async function deleteBill(id: number) {
    if (!confirm("Remover esta conta?")) return;
    await fetch(`/api/bills/${id}`, { method: "DELETE" });
    setBills((prev) => prev.filter((b) => b.id !== id));
  }

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const paidBills = bills.filter((b) => b.isPaid).reduce((s, b) => s + b.amount, 0);
  const pendingBills = bills.filter((b) => !b.isPaid).reduce((s, b) => s + b.amount, 0);
  const totalIncome = salaries.reduce((s, sal) => s + sal.amount, 0);
  const balance = totalIncome - totalBills;

  const today = now.getDate();
  const isDueSoon = (bill: Bill) =>
    !bill.isPaid && bill.dueDay && month === now.getMonth() + 1 && year === now.getFullYear() &&
    bill.dueDay - today >= 0 && bill.dueDay - today <= 3;
  const isOverdue = (bill: Bill) =>
    !bill.isPaid && bill.dueDay && month === now.getMonth() + 1 && year === now.getFullYear() &&
    bill.dueDay < today;

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "#8dcdb0" }}>
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-black min-w-40 text-center" style={{ fontFamily: "var(--font-display)" }}>
            {MONTHS[month - 1]} {year}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "#8dcdb0" }}>
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          onClick={() => { setEditBill(null); setShowForm(true); }}
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
          <div className="text-xs mb-1 uppercase tracking-wide" style={{ color: "#4a6b58" }}>Total</div>
          <div className="text-lg font-bold font-numeric" style={{ color: "#f0f9f4" }}>{BRL(totalBills)}</div>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <div className="text-xs mb-1 uppercase tracking-wide" style={{ color: "#4a6b58" }}>Renda</div>
          <div className="text-lg font-bold font-numeric" style={{ color: "#5ab28d" }}>{BRL(totalIncome)}</div>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <div className="text-xs mb-1 uppercase tracking-wide" style={{ color: "#4a6b58" }}>Pendente</div>
          <div className="text-lg font-bold font-numeric" style={{ color: "#f59e0b" }}>{BRL(pendingBills)}</div>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <div className="text-xs mb-1 uppercase tracking-wide" style={{ color: "#4a6b58" }}>Saldo</div>
          <div className="text-lg font-bold font-numeric" style={{ color: balance >= 0 ? "#5ab28d" : "#ef4444" }}>{BRL(balance)}</div>
        </div>
      </div>

      {/* Salaries */}
      {salaries.length > 0 && (
        <div className="card p-4">
          <button onClick={() => setShowSalaries(true)} className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: "#4a6b58" }}>Salários</button>
          <div className="flex flex-wrap gap-3">
            {salaries.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "#8dcdb0" }}>{s.person}:</span>
                <span className="text-sm font-bold font-numeric" style={{ color: "#5ab28d" }}>{BRL(s.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bills list */}
      {loading ? (
        <div className="card p-8 text-center" style={{ color: "#4a6b58" }}>Carregando...</div>
      ) : bills.length === 0 ? (
        <div className="card p-8 text-center space-y-3">
          <div className="text-3xl">📋</div>
          <p style={{ color: "#4a6b58" }}>Nenhuma conta em {MONTHS[month - 1]}</p>
          <button
            onClick={() => { setEditBill(null); setShowForm(true); }}
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
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.02]"
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
                    {bill.isPaid && <Check size={12} strokeWidth={3} color="#fff" />}
                  </button>

                  {/* Name & details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium truncate"
                        style={{ color: bill.isPaid ? "#4a6b58" : "#f0f9f4", textDecoration: bill.isPaid ? "line-through" : "none" }}
                      >
                        {bill.name}
                      </span>
                      {(dueSoon || overdue) && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${overdue ? "badge-overdue" : "badge-pending"}`}>
                          {overdue ? "Vencida" : `Vence em ${bill.dueDay! - today}d`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {bill.installment && (
                        <span className="text-xs" style={{ color: "#4a6b58" }}>{bill.installment}</span>
                      )}
                      {bill.dueDay && (
                        <span className="text-xs" style={{ color: "#4a6b58" }}>dia {bill.dueDay}</span>
                      )}
                      {bill.category && (
                        <span className="text-xs" style={{ color: "#4a6b58" }}>{bill.category}</span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <span
                    className="text-sm font-bold font-numeric flex-shrink-0"
                    style={{ color: bill.isPaid ? "#4a6b58" : "#f0f9f4" }}
                  >
                    {BRL(bill.amount)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditBill(bill); setShowForm(true); }}
                      className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                      style={{ color: "#4a6b58" }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteBill(bill.id)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                      style={{ color: "#4a6b58" }}
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
            <span className="text-sm font-semibold" style={{ color: "#8dcdb0" }}>
              Total ({bills.filter((b) => b.isPaid).length}/{bills.length} pagos)
            </span>
            <span className="text-sm font-bold font-numeric" style={{ color: "#f0f9f4" }}>
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
          onClose={() => { setShowForm(false); setEditBill(null); }}
          onSave={() => { setShowForm(false); setEditBill(null); fetchData(); }}
        />
      )}

      {/* Salaries Modal */}
      {showSalaries && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowSalaries(false)} />
          <div className="fixed inset-0 z-50 flex justify-center p-4 items-end sm:items-start">
            <div className="w-full sm:max-w-2xl max-h-[90vh] overflow-auto">
              <div className="card p-4">
                <SalariesManager month={month} year={year} onClose={() => setShowSalaries(false)} onSave={() => { setShowSalaries(false); fetchData(); }} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BillForm({
  bill,
  month,
  year,
  onClose,
  onSave,
}: {
  bill: Bill | null;
  month: number;
  year: number;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(bill?.name || "");
  const [amount, setAmount] = useState(bill?.amount?.toString() || "");
  const [installment, setInstallment] = useState(bill?.installment || "");
  const [isPaid, setIsPaid] = useState(bill?.isPaid || false);
  const [dueDay, setDueDay] = useState(bill?.dueDay?.toString() || "");
  const [category, setCategory] = useState(bill?.category || "");
  const [notes, setNotes] = useState(bill?.notes || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name: name.trim().toUpperCase(),
      amount: parseFloat(amount.replace(",", ".")),
      month,
      year,
      installment: installment || null,
      isPaid,
      dueDay: dueDay ? parseInt(dueDay) : null,
      category: category || null,
      notes: notes || null,
    };

    if (bill) {
      await fetch(`/api/bills/${bill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    onSave();
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex justify-center p-4 items-end sm:items-start">
        <form
          onSubmit={handleSubmit}
          className="card rounded-t-2xl sm:rounded-2xl p-6 space-y-4 w-full sm:max-w-md max-h-[90vh] overflow-auto mt-0 sm:mt-[20vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-base font-black" style={{ fontFamily: "var(--font-display)" }}>
            {bill ? "Editar conta" : "Nova conta"}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>Nome *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-base" placeholder="ALUGUEL" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>Valor *</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className="input-base" placeholder="440,00" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>Vencimento (dia)</label>
              <input value={dueDay} onChange={(e) => setDueDay(e.target.value)} className="input-base" placeholder="10" type="number" min="1" max="31" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>Parcela</label>
              <input value={installment} onChange={(e) => setInstallment(e.target.value)} className="input-base" placeholder="SEMPRE ou 3/12" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-base">
                <option value="">Selecionar...</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} style={{ background: "#1c2b22" }}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>Observações</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-base" placeholder="Notas opcionais..." />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
              style={{ borderColor: isPaid ? "#389671" : "#2a3d31", background: isPaid ? "#389671" : "transparent" }}
              onClick={() => setIsPaid(!isPaid)}
            >
              {isPaid && <Check size={12} strokeWidth={3} color="#fff" />}
            </div>
            <span className="text-sm" style={{ color: "#8dcdb0" }}>Marcar como pago</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: "#1c2b22", color: "#8dcdb0", border: "1px solid #2a3d31" }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: "#389671", color: "#fff" }}>
              {saving ? "Salvando..." : bill ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
