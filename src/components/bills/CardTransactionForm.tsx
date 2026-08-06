"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import ModalPortal from "@/components/ui/ModalPortal";

export interface CardTransactionItem {
  id?: number;
  name: string;
  quantity: number;
  unitPrice?: number | null;
  amount: number;
}

interface CardTransaction {
  id: number;
  name: string;
  amount: number;
  installment?: string | null;
  category?: string | null;
  date?: string | null;
  items?: CardTransactionItem[];
}

interface ItemRow {
  name: string;
  quantity: string;
  amount: string;
  unitPrice: number | null;
}

const CATEGORIES = [
  "alimentação",
  "compras",
  "lazer",
  "saúde",
  "transporte",
  "assinaturas",
  "outros",
];

const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const toNumber = (v: string) => Number.parseFloat((v || "0").replace(",", ".")) || 0;

function itemsFrom(transaction?: CardTransaction | null): ItemRow[] {
  return (transaction?.items || []).map((it) => ({
    name: it.name,
    quantity: String(it.quantity ?? 1),
    amount: String(it.amount ?? 0),
    unitPrice: it.unitPrice ?? null,
  }));
}

export default function CardTransactionForm({
  billId,
  transaction,
  onClose,
  onSave,
}: Readonly<{
  billId: number;
  transaction?: CardTransaction | null;
  onClose: () => void;
  onSave: () => void;
}>) {
  const isEditing = !!transaction;
  const [name, setName] = useState(transaction?.name || "");
  const [amount, setAmount] = useState(transaction?.amount?.toString() || "");
  const [installment, setInstallment] = useState(transaction?.installment || "");
  const [category, setCategory] = useState(transaction?.category || "");
  const [date, setDate] = useState(transaction?.date || "");
  const [items, setItems] = useState<ItemRow[]>(itemsFrom(transaction));
  const [saving, setSaving] = useState(false);

  // Compra parcelada: usuário informa o valor total e o nº de parcelas.
  // Só disponível ao criar (edição mexe em uma parcela específica).
  const [installmentMode, setInstallmentMode] = useState(false);
  const [totalAmount, setTotalAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("");

  const itemsTotal = items.reduce((s, r) => s + toNumber(r.amount), 0);

  // Parcelas iguais = round(total/N, 2). Mantém consistência ao carregar a mesma
  // parcela para o próximo mês na migração (ela apenas copia o valor).
  const parsedTotal = toNumber(totalAmount);
  const parsedCount = Math.trunc(toNumber(installmentCount));
  const perInstallment =
    parsedCount > 0 ? Math.round((parsedTotal / parsedCount) * 100) / 100 : 0;
  const installmentValid = parsedTotal > 0 && parsedCount >= 2;

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function addItem() {
    setItems((prev) => [...prev, { name: "", quantity: "1", amount: "", unitPrice: null }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const cleanItems = items
      .filter((r) => r.name.trim() !== "")
      .map((r) => ({
        name: r.name.trim(),
        quantity: toNumber(r.quantity) || 1,
        unitPrice: r.unitPrice,
        amount: toNumber(r.amount),
      }));

    const useInstallment = installmentMode && !isEditing && installmentValid;

    const payload = {
      name: name.trim().toUpperCase(),
      amount: useInstallment
        ? perInstallment
        : amount
          ? Number.parseFloat(amount.replace(",", "."))
          : undefined,
      installment: useInstallment ? `1/${parsedCount}` : installment || null,
      category: category || null,
      date: date || null,
      // Compra parcelada representa a 1ª parcela — sem itens (produtos) atrelados.
      items: useInstallment ? [] : cleanItems,
    };

    if (transaction) {
      await fetch(`/api/bills/${billId}/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`/api/bills/${billId}/transactions`, {
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
      <div className="fixed inset-0 z-50 flex justify-center p-4 items-end sm:items-start">
        <form
          onSubmit={handleSubmit}
          className="card rounded-t-2xl sm:rounded-2xl p-6 space-y-4 w-full sm:max-w-md max-h-[90vh] overflow-auto mt-0 sm:mt-[20vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="text-sm font-bold" style={{ color: "#f0f9f4" }}>
            {transaction ? "Editar transação" : "Nova transação"}
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                Descrição *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 rounded bg-[#0f1a15] text-sm"
                placeholder="SPOTIFY"
                required
              />
            </div>

            {!isEditing && (
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer" style={{ color: "#8dcdb0" }}>
                  <input
                    type="checkbox"
                    checked={installmentMode}
                    onChange={(e) => setInstallmentMode(e.target.checked)}
                    className="accent-[#389671]"
                  />
                  Compra parcelada (dividir em N vezes)
                </label>
              </div>
            )}

            {installmentMode && !isEditing ? (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                    Valor total *
                  </label>
                  <input
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    inputMode="decimal"
                    className="w-full p-2 rounded bg-[#0f1a15] text-sm"
                    placeholder="1200,00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                    Nº de parcelas *
                  </label>
                  <input
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(e.target.value)}
                    inputMode="numeric"
                    className="w-full p-2 rounded bg-[#0f1a15] text-sm"
                    placeholder="10"
                    required
                  />
                </div>

                <div className="col-span-2 text-[11px]" style={{ color: installmentValid ? "#5ab28d" : "#4a6b58" }}>
                  {installmentValid
                    ? `${parsedCount}x de ${BRL(perInstallment)} — a 1ª parcela (1/${parsedCount}) entra nesta fatura; as próximas são adicionadas ao migrar o mês.`
                    : "Informe o valor total e um nº de parcelas ≥ 2."}
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                    Valor *
                  </label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className="w-full p-2 rounded bg-[#0f1a15] text-sm"
                    placeholder="29,90"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                    Parcela
                  </label>
                  <input
                    value={installment}
                    onChange={(e) => setInstallment(e.target.value)}
                    className="w-full p-2 rounded bg-[#0f1a15] text-sm"
                    placeholder="3/12"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 rounded bg-[#0f1a15] text-sm"
              >
                <option value="">Selecionar...</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} style={{ background: "#1c2b22" }}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                Data
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 rounded bg-[#0f1a15] text-sm"
              />
            </div>
          </div>

          {/* Itens (produtos) — não se aplica a compra parcelada */}
          {!(installmentMode && !isEditing) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                Produtos ({items.length})
              </span>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                style={{ background: "#1c2b22", color: "#8dcdb0", border: "1px solid #2a3d31" }}
              >
                <Plus size={12} />
                Item
              </button>
            </div>

            {items.length > 0 && (
              <div className="space-y-1.5">
                {items.map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      value={row.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      className="flex-1 min-w-0 p-1.5 rounded bg-[#0f1a15] text-xs"
                      placeholder="Produto"
                    />
                    <input
                      value={row.quantity}
                      onChange={(e) => updateItem(i, { quantity: e.target.value })}
                      inputMode="decimal"
                      className="w-12 p-1.5 rounded bg-[#0f1a15] text-xs text-center"
                      placeholder="1"
                      aria-label="Quantidade"
                    />
                    <input
                      value={row.amount}
                      onChange={(e) => updateItem(i, { amount: e.target.value })}
                      inputMode="decimal"
                      className="w-20 p-1.5 rounded bg-[#0f1a15] text-xs text-right"
                      placeholder="0,00"
                      aria-label="Valor do item"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="p-1.5 rounded flex-shrink-0"
                      style={{ background: "#1c2b22", color: "#ef4444" }}
                      aria-label="Remover item"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px]" style={{ color: "#4a6b58" }}>
                    Soma dos itens: {BRL(itemsTotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAmount(itemsTotal.toFixed(2))}
                    className="text-[11px] font-medium underline"
                    style={{ color: "#5ab28d" }}
                  >
                    Usar como total
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded text-sm"
              style={{ background: "#1c2b22", border: "1px solid #2a3d31", color: "#8dcdb0" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-2 rounded text-sm font-semibold"
              style={{ background: "#389671", color: "#fff" }}
            >
              {saving ? "Salvando..." : transaction ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
