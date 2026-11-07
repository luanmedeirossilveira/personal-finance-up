"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import showToast from "@/components/ui/toast";
import showConfirm from "@/components/ui/confirm";
import BillsMobileActions from "@/components/bills/BillsMobileActions";
import CardBillTransactions from "@/components/bills/CardBillTransactions";
import { BRL, MONTHS, formatDateBR } from "@/lib/month";
import type { Attachments, Bill, BillSort, FutureBill, OwnershipFilter } from "./types";
import type { MonthData } from "./useMonthData";

const OWNERSHIP_BADGE: Record<Bill["ownership"], { label: string; color: string; bg: string }> = {
  mine: { label: "Minha", color: "rgb(var(--owner-mine))", bg: "rgb(var(--owner-mine-bg))" },
  joint: { label: "Conjunta", color: "rgb(var(--owner-joint))", bg: "rgb(var(--owner-joint-bg))" },
  hers: { label: "Dela", color: "rgb(var(--owner-hers))", bg: "rgb(var(--owner-hers-bg))" },
};

function parseAttachments(raw?: string | null): Attachments {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Padrão: data de pagamento (mais antiga primeiro); sem data cai por nome A-Z ao final.
function sortBills(bills: Bill[], sortBy: BillSort) {
  return [...bills].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name, "pt-BR");
    if (a.date && b.date) return a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "pt-BR");
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

// Aba Contas: lista enxuta (nome, vencimento, valor, check de pago); fatura expande transações.
export default function BillsTab({
  data,
  ownershipFilter,
  sortBy,
  locked = false,
  onEdit,
  onNew,
}: Readonly<{
  data: MonthData;
  ownershipFilter: OwnershipFilter;
  sortBy: BillSort;
  /** Mês fechado: sem marcar/desmarcar, editar ou remover. */
  locked?: boolean;
  onEdit: (bill: Bill) => void;
  onNew: () => void;
}>) {
  const { bills, month, year, loading, monthFuture } = data;
  const [expanded, setExpanded] = useState<number[]>([]);

  const filtered = ownershipFilter === "all" ? bills : bills.filter((b) => b.ownership === ownershipFilter);
  const sorted = sortBills(filtered, sortBy);
  const total = filtered.reduce((s, b) => s + b.amount, 0);

  const now = new Date();
  const today = now.getDate();
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  async function handleUpload(billId: number, type: "fatura" | "comprovante", file?: File) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    await fetch(`/api/bills/${billId}/attachment`, { method: "POST", body: form });
    data.fetchData();
  }

  async function handleDeleteAttachment(billId: number, type: "fatura" | "comprovante") {
    const ok = await showConfirm(`Remover ${type}?`);
    if (!ok) return;
    await fetch(`/api/bills/${billId}/attachment?type=${type}`, { method: "DELETE" });
    data.fetchData();
  }

  if (loading) {
    return (
      <div className="card p-8 text-center" style={{ color: "rgb(var(--text-muted))" }}>
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filtered.length === 0 ? (
        <div className="card p-8 text-center space-y-3">
          <p style={{ color: "rgb(var(--text-muted))" }}>Nenhuma conta em {MONTHS[month - 1]}</p>
          {!locked && (
            <button onClick={onNew} className="text-sm font-medium underline" style={{ color: "rgb(var(--accent))" }}>
              Adicionar conta
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-visible">
          <div className="divide-y divide-line">
            {sorted.map((bill) => {
              const isCard = bill.type === "CARD";
              const isExpanded = expanded.includes(bill.id);
              const overdue = isCurrentMonth && !bill.isPaid && !!bill.dueDay && bill.dueDay < today;
              const dueIn = isCurrentMonth && bill.dueDay ? bill.dueDay - today : null;
              const dueSoon = !bill.isPaid && dueIn !== null && dueIn >= 0 && dueIn <= 3;
              const badge = OWNERSHIP_BADGE[bill.ownership];

              return (
                <div key={bill.id}>
                  <div className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-fg/[0.03]">
                    <button
                      onClick={() => data.togglePaid(bill)}
                      disabled={locked}
                      aria-label={bill.isPaid ? "Desmarcar pago" : "Marcar como pago"}
                      className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        borderColor: bill.isPaid ? "rgb(var(--accent-strong))" : "rgb(var(--border))",
                        background: bill.isPaid ? "rgb(var(--accent-strong))" : "transparent",
                      }}
                    >
                      {bill.isPaid && <Check size={12} strokeWidth={3} color="rgb(var(--on-accent))" />}
                    </button>

                    <button className="flex-1 min-w-0 text-left" onClick={() => !locked && onEdit(bill)} disabled={locked}>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-medium truncate"
                          style={{
                            color: bill.isPaid ? "rgb(var(--text-muted))" : "rgb(var(--text))",
                            textDecoration: bill.isPaid ? "line-through" : "none",
                          }}
                        >
                          {bill.name}
                        </span>
                        {(dueSoon || overdue) && (
                          <span
                            className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${overdue ? "badge-overdue" : "badge-pending"}`}
                          >
                            {overdue ? "Vencida" : dueIn === 0 ? "Vence hoje" : `Vence em ${dueIn}d`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                        {bill.dueDay && <span>dia {bill.dueDay}</span>}
                        {bill.installment && <span>{bill.installment}</span>}
                        {bill.isPaid && bill.date && (
                          <span style={{ color: "rgb(var(--accent))" }}>pago em {formatDateBR(bill.date)}</span>
                        )}
                        {isCard && bill.cardLast4 && <span>•••• {bill.cardLast4}</span>}
                        {ownershipFilter === "all" && bill.ownership !== "joint" && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                            style={{ color: badge.color, background: badge.bg }}
                          >
                            {badge.label}
                          </span>
                        )}
                      </div>
                    </button>

                    <span
                      className="text-sm font-numeric flex-shrink-0 text-right"
                      style={{ color: bill.isPaid ? "rgb(var(--text-muted))" : "rgb(var(--text))" }}
                    >
                      {BRL(bill.amount)}
                    </span>

                    {isCard && (
                      <button
                        onClick={() =>
                          setExpanded((prev) =>
                            prev.includes(bill.id) ? prev.filter((id) => id !== bill.id) : [...prev, bill.id],
                          )
                        }
                        aria-label={isExpanded ? "Recolher fatura" : "Ver transações da fatura"}
                        className="p-1.5 rounded-lg transition-colors hover:bg-fg/5"
                        style={{ color: "rgb(var(--text-soft))" }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}

                    {!locked && (
                    <BillsMobileActions
                      bill={bill}
                      att={parseAttachments(bill.attachments)}
                      onEdit={() => onEdit(bill)}
                      onDelete={() => data.deleteBill(bill.id)}
                      onUpload={handleUpload}
                      onDeleteAttachment={handleDeleteAttachment}
                    />
                    )}
                  </div>

                  {isCard && isExpanded && (
                    <div className="px-4 pb-3 ml-9" style={{ background: "rgb(var(--bg))" }}>
                      <CardBillTransactions
                        billId={bill.id}
                        onTotalChange={(newTotal) => data.setBillAmount(bill.id, newTotal)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            className="px-4 py-3 flex justify-between items-center rounded-b-2xl"
            style={{ background: "rgb(var(--surface-raised))", borderTop: "1px solid rgb(var(--border))" }}
          >
            <span className="text-sm" style={{ color: "rgb(var(--text-soft))" }}>
              {filtered.filter((b) => b.isPaid).length} de {filtered.length} pagas
            </span>
            <span className="text-sm font-numeric">{BRL(total)}</span>
          </div>
        </div>
      )}

      {!locked && monthFuture.length > 0 && <PrevistoList items={monthFuture} data={data} />}
    </div>
  );
}

// Futuras do mês: estilo pontilhado até virarem conta real.
function PrevistoList({ items, data }: Readonly<{ items: FutureBill[]; data: MonthData }>) {
  const [busy, setBusy] = useState<number | null>(null);

  async function accept(f: FutureBill) {
    setBusy(f.id);
    const ok = await data.acceptFuture(f);
    setBusy(null);
    showToast(ok ? `"${f.name}" virou conta de ${MONTHS[data.month - 1]}.` : "Não foi possível criar a conta.");
  }

  async function remove(f: FutureBill) {
    const ok = await showConfirm(`Remover o previsto "${f.name}"?`);
    if (!ok) return;
    await fetch(`/api/future-bills?id=${f.id}`, { method: "DELETE" });
    data.fetchData();
  }

  return (
    <div className="space-y-2">
      <div className="label-sm px-1">Previsto</div>
      {items.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ border: "1.5px dashed rgb(var(--border))" }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--text-soft))" }}>
              {f.name}
            </div>
            <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
              {f.reminderDate ? `lembrete ${formatDateBR(f.reminderDate)}` : "sem data"}
              {f.amount ? "" : " · valor a definir"}
            </div>
          </div>
          <span className="text-sm font-numeric" style={{ color: "rgb(var(--text-muted))" }}>
            {f.amount ? `~${BRL(f.amount)}` : "—"}
          </span>
          <button
            onClick={() => accept(f)}
            disabled={busy === f.id}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
            style={{ background: "rgb(var(--accent-strong) / 0.15)", color: "rgb(var(--accent))" }}
          >
            Virar conta <ArrowRight size={12} />
          </button>
          <button
            onClick={() => remove(f)}
            aria-label="Remover previsto"
            className="p-1.5 rounded-lg hover:bg-fg/5"
            style={{ color: "rgb(var(--text-muted))" }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
