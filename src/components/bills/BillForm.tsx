// src/components/bills/BillForm.tsx
import { useEffect, useState } from "react";
import type { Bill } from "@/components/month/types";
import { Check, CreditCard, Receipt } from "lucide-react";
import type { BillOwnership } from "@/lib/db/schema";
import ModalPortal from "@/components/ui/ModalPortal";
import { BILL_FORM_CATEGORIES, categoryLabel } from "@/lib/categories";


// v2: rótulos e cores de ownership
const OWNERSHIP_OPTIONS: {
  value: BillOwnership;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  activeBg: string;
}[] = [
  {
    value: "mine",
    label: "Minha",
    emoji: "🧑",
    color: "rgb(var(--owner-mine))",
    bg: "rgb(var(--owner-mine-bg))",
    activeBg: "#1d4ed8",
  },
  {
    value: "joint",
    label: "Conjunta",
    emoji: "🤝",
    color: "rgb(var(--owner-joint))",
    bg: "rgb(var(--surface-raised))",
    activeBg: "rgb(var(--accent-strong))",
  },
  {
    value: "hers",
    label: "Dela",
    emoji: "👩",
    color: "rgb(var(--owner-hers))",
    bg: "rgb(var(--owner-hers-bg))",
    activeBg: "#be185d",
  },
];

export default function BillForm({
  bill,
  month,
  year,
  onClose,
  onSave,
}: Readonly<{
  bill: Bill | null;
  month: number;
  year: number;
  onClose: () => void;
  onSave: () => void;
}>) {
  const [type, setType] = useState<"NORMAL" | "CARD">(
    bill?.type === "CARD" ? "CARD" : "NORMAL",
  );
  const [name, setName] = useState(bill?.name || "");
  const [amount, setAmount] = useState(bill?.amount?.toString() || "");
  const [installment, setInstallment] = useState(bill?.installment || "");
  const [isPaid, setIsPaid] = useState(bill?.isPaid || false);
  const [dueDay, setDueDay] = useState(bill?.dueDay?.toString() || "");
  const [category, setCategory] = useState(bill?.category || "");
  const [ownership, setOwnership] = useState<BillOwnership>(
    (bill?.ownership as BillOwnership) || "joint",
  );
  const [notes, setNotes] = useState(bill?.notes || "");
  const [barCode, setBarCode] = useState(bill?.barCode || "");
  const [qrCode, setQrCode] = useState(bill?.qrCode || "");
  const [cardLast4, setCardLast4] = useState(bill?.cardLast4 || "");
  const [cardNickname, setCardNickname] = useState(bill?.cardNickname || "");
  const [date, setDate] = useState(bill?.date || "");
  const [saving, setSaving] = useState(false);
  // v3: sem o valor exato, a conta vira uma Futura (lembrete) até ser confirmada.
  const [estimateOnly, setEstimateOnly] = useState(false);
  // v3: aporte vinculado a um investimento — ao pagar, soma no aplicado.
  const [investmentId, setInvestmentId] = useState<string>(bill?.investmentId ? String(bill.investmentId) : "");
  const [investments, setInvestments] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (category !== "investimentos" || investments.length > 0) return;
    fetch("/api/accounts")
      .then((r) => (r.ok ? r.json() : { investments: [] }))
      .then((d) => setInvestments((d.investments ?? []).map((i: { id: number; name: string }) => ({ id: i.id, name: i.name }))))
      .catch(() => setInvestments([]));
  }, [category, investments.length]);
  const canBeFuture = !bill && type === "NORMAL";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    if (canBeFuture && estimateOnly) {
      const day = dueDay ? Math.min(Math.max(parseInt(dueDay), 1), 28) : 1;
      const reminderDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const parsed = parseFloat(amount.replace(",", "."));
      await fetch("/api/future-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim().toUpperCase(),
          amount: Number.isFinite(parsed) ? parsed : null,
          reminderDate,
          notes: notes || null,
        }),
      });
      setSaving(false);
      onSave();
      return;
    }

    const payload: any = {
      name: name.trim().toUpperCase(),
      amount: parseFloat(amount.replace(",", ".")),
      month,
      year,
      installment: installment || null,
      isPaid,
      dueDay: dueDay ? parseInt(dueDay) : null,
      category: type === "CARD" ? "cartão" : category || null,
      ownership,
      notes: notes || null,
      barCode: type === "CARD" ? null : barCode || null,
      qrCode: type === "CARD" ? null : qrCode || null,
      type,
      cardLast4: type === "CARD" ? cardLast4 : null,
      cardNickname: type === "CARD" ? cardNickname : null,
      date: date || null,
      investmentId: type === "NORMAL" && category === "investimentos" && investmentId ? Number(investmentId) : null,
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
    <ModalPortal>
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex justify-center p-4 items-end sm:items-center">
        <form
          onSubmit={handleSubmit}
          className="card rounded-t-2xl sm:rounded-2xl p-6 space-y-4 w-full sm:max-w-md max-h-[90vh] overflow-visible relative z-[60]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="max-h-[calc(90vh-3rem)] overflow-y-auto pr-1">
          <h3
            className="text-base font-black"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {bill ? "Editar conta" : "Nova conta"}
          </h3>

          {/* Type selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("NORMAL")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                type === "NORMAL" ? "ring-2 ring-offset-1" : ""
              }`}
              style={{
                background: type === "NORMAL" ? "rgb(var(--accent-strong))" : "rgb(var(--surface-raised))",
                color: type === "NORMAL" ? "rgb(var(--on-accent))" : "rgb(var(--text-soft))",
                borderColor: "rgb(var(--border))",
              }}
            >
              <Receipt size={16} />
              Conta normal
            </button>
            <button
              type="button"
              onClick={() => setType("CARD")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                type === "CARD" ? "ring-2 ring-offset-1" : ""
              }`}
              style={{
                background: type === "CARD" ? "rgb(var(--accent-strong))" : "rgb(var(--surface-raised))",
                color: type === "CARD" ? "rgb(var(--on-accent))" : "rgb(var(--text-soft))",
                borderColor: "rgb(var(--border))",
              }}
            >
              <CreditCard size={16} />
              Fatura cartão
            </button>
          </div>

          {/* Ownership selector — v2: Governança do casal */}
          <div>
            <label
              className="block text-xs font-medium mb-2 uppercase tracking-wide"
              style={{ color: "rgb(var(--text-soft))" }}
            >
              De quem é essa conta?
            </label>
            <div className="flex gap-2">
              {OWNERSHIP_OPTIONS.map((opt) => {
                const isActive = ownership === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOwnership(opt.value)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive ? "ring-2 ring-fg/20" : ""
                    }`}
                    style={{
                      background: isActive ? opt.activeBg : opt.bg,
                      color: isActive ? "rgb(var(--on-accent))" : opt.color,
                      border: `1px solid ${isActive ? opt.activeBg : "rgb(var(--border))"}`,
                    }}
                  >
                    <span className="text-base leading-none">{opt.emoji}</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Card-specific fields */}
            {type === "CARD" && (
              <>
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                    style={{ color: "rgb(var(--text-soft))" }}
                  >
                    Últimos 4 dígitos
                  </label>
                  <input
                    value={cardLast4}
                    onChange={(e) =>
                      setCardLast4(
                        e.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    className="input-base"
                    placeholder="1234"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                    style={{ color: "rgb(var(--text-soft))" }}
                  >
                    Apelido
                  </label>
                  <input
                    value={cardNickname}
                    onChange={(e) => setCardNickname(e.target.value)}
                    className="input-base"
                    placeholder="Nubank Luan"
                  />
                </div>
              </>
            )}

            <div className={type === "CARD" ? "col-span-2" : "col-span-2"}>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "rgb(var(--text-soft))" }}
              >
                {type === "CARD" ? "Nome da fatura *" : "Nome *"}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-base"
                placeholder={
                  type === "CARD" ? "FATURA NUBANK ABR/2026" : "ALUGUEL"
                }
                required
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "rgb(var(--text-soft))" }}
              >
                {type === "CARD" ? "Valor total *" : estimateOnly ? "Valor estimado" : "Valor *"}
              </label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-base"
                placeholder="440,00"
                required={!(canBeFuture && estimateOnly)}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "rgb(var(--text-soft))" }}
              >
                Vencimento (dia)
              </label>
              <input
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="input-base"
                placeholder="10"
                type="number"
                min="1"
                max="31"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "rgb(var(--text-soft))" }}
              >
                Parcela
              </label>
              <input
                value={installment}
                onChange={(e) => setInstallment(e.target.value)}
                className="input-base"
                placeholder="SEMPRE ou 3/12"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "rgb(var(--text-soft))" }}
              >
                Data de pagamento
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-base"
              />
            </div>
            {type === "NORMAL" && (
              <div>
                <label
                  className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                  style={{ color: "rgb(var(--text-soft))" }}
                >
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-base relative z-[70]"
                >
                  <option value="">Selecionar...</option>
                  {BILL_FORM_CATEGORIES.map((c) => (
                    <option key={c} value={c} style={{ background: "rgb(var(--surface-raised))" }}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {type === "NORMAL" && category === "investimentos" && investments.length > 0 && (
              <div className="col-span-2">
                <label
                  className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                  style={{ color: "rgb(var(--text-soft))" }}
                >
                  Aporte em
                </label>
                <select value={investmentId} onChange={(e) => setInvestmentId(e.target.value)} className="input-base">
                  <option value="">Nenhum investimento</option>
                  {investments.map((i) => (
                    <option key={i.id} value={i.id} style={{ background: "rgb(var(--surface-raised))" }}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "rgb(var(--text-soft))" }}
              >
                Observações
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-base"
                placeholder="Notas opcionais..."
              />
            </div>
            {type === "NORMAL" && (
              <>
                <div className="col-span-2">
                  <label
                    className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                    style={{ color: "rgb(var(--text-soft))" }}
                  >
                    Código de barras
                  </label>
                  <input
                    value={barCode}
                    onChange={(e) => setBarCode(e.target.value)}
                    className="input-base"
                    placeholder="Código de barras (opcional)"
                  />
                </div>
                <div className="col-span-2">
                  <label
                    className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                    style={{ color: "rgb(var(--text-soft))" }}
                  >
                    QR Code
                  </label>
                  <input
                    value={qrCode}
                    onChange={(e) => setQrCode(e.target.value)}
                    className="input-base"
                    placeholder="QR Code (opcional)"
                  />
                </div>
              </>
            )}
          </div>

          {canBeFuture && (
            <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
              <span className="text-sm" style={{ color: "rgb(var(--text-soft))" }}>
                Ainda não tenho o valor exato
                <span className="block text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                  Fica como previsto no mês até virar conta
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={estimateOnly}
                onClick={() => setEstimateOnly((v) => !v)}
                className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
                style={{ background: estimateOnly ? "rgb(var(--accent-strong))" : "rgb(var(--border))" }}
              >
                <span
                  className="absolute top-1 w-4 h-4 rounded-full transition-all"
                  style={{ left: estimateOnly ? 20 : 4, background: "rgb(var(--on-accent))" }}
                />
              </button>
            </label>
          )}

          {!(canBeFuture && estimateOnly) && (
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
              style={{
                borderColor: isPaid ? "rgb(var(--accent-strong))" : "rgb(var(--border))",
                background: isPaid ? "rgb(var(--accent-strong))" : "transparent",
              }}
              onClick={() => setIsPaid(!isPaid)}
            >
              {isPaid && <Check size={12} strokeWidth={3} color="rgb(var(--on-accent))" />}
            </div>
            <span className="text-sm" style={{ color: "rgb(var(--text-soft))" }}>
              Marcar como pago
            </span>
          </label>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{
                background: "rgb(var(--surface-raised))",
                color: "rgb(var(--text-soft))",
                border: "1px solid rgb(var(--border))",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
            >
              {saving ? "Salvando..." : bill ? "Salvar" : estimateOnly && canBeFuture ? "Prever" : "Adicionar"}
            </button>
          </div>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
