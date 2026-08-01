// src/components/meal-cards/MealCardTransactionForm.tsx
"use client";

import { useRef, useState } from "react";
import { Camera, Plus, X, Loader2 } from "lucide-react";

export interface MealTransactionItem {
  id?: number;
  name: string;
  quantity: number;
  unitPrice?: number | null;
  amount: number;
}

interface MealTransaction {
  id: number;
  name: string;
  amount: number;
  category?: string | null;
  date?: string | null;
  items?: MealTransactionItem[];
}

interface ItemRow {
  name: string;
  quantity: string;
  amount: string;
  unitPrice: number | null;
}

const CATEGORIES = ["refeição", "mercado", "lanche", "delivery", "padaria", "outros"];

const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const toNumber = (v: string) => Number.parseFloat((v || "0").replace(",", ".")) || 0;

function itemsFrom(transaction?: MealTransaction | null): ItemRow[] {
  return (transaction?.items || []).map((it) => ({
    name: it.name,
    quantity: String(it.quantity ?? 1),
    amount: String(it.amount ?? 0),
    unitPrice: it.unitPrice ?? null,
  }));
}

export default function MealCardTransactionForm({
  cardId,
  transaction,
  onClose,
  onSave,
}: Readonly<{
  cardId: number;
  transaction?: MealTransaction | null;
  onClose: () => void;
  onSave: () => void;
}>) {
  const [name, setName] = useState(transaction?.name || "");
  const [amount, setAmount] = useState(transaction?.amount?.toString() || "");
  const [category, setCategory] = useState(transaction?.category || "");
  const [date, setDate] = useState(transaction?.date || "");
  const [items, setItems] = useState<ItemRow[]>(itemsFrom(transaction));
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSource, setScanSource] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const itemsTotal = items.reduce((s, r) => s + toNumber(r.amount), 0);

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function addItem() {
    setItems((prev) => [...prev, { name: "", quantity: "1", amount: "", unitPrice: null }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleScan(file: File) {
    setScanError(null);
    setScanSource(null);
    setScanning(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/meal-cards/${cardId}/scan-receipt`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setScanError(err.error || "Não foi possível ler a imagem.");
        return;
      }
      const data = await res.json();
      setScanSource(data.source ?? null);
      if (data.store) setName(String(data.store));
      if (data.total != null) setAmount(String(data.total));
      if (data.date) setDate(String(data.date));
      const scanned: ItemRow[] = Array.isArray(data.items)
        ? data.items.map((it: MealTransactionItem) => ({
            name: it.name,
            quantity: String(it.quantity ?? 1),
            amount: String(it.amount ?? 0),
            unitPrice: it.unitPrice ?? null,
          }))
        : [];
      setItems(scanned);
      if (scanned.length === 0) {
        setScanError("Nenhum item reconhecido. Preencha manualmente.");
      }
    } catch {
      setScanError("Falha na leitura. Tente novamente.");
    } finally {
      setScanning(false);
    }
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

    const payload = {
      name: name.trim(),
      amount: amount ? toNumber(amount) : undefined,
      category: category || null,
      date: date || null,
      items: cleanItems,
    };

    if (transaction) {
      await fetch(`/api/meal-cards/${cardId}/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`/api/meal-cards/${cardId}/transactions`, {
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
            {transaction ? "Editar compra" : "Nova compra"}
          </h4>

          {/* Scan cupom (IA de visão) */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleScan(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={scanning}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.99] disabled:opacity-70"
              style={{ background: "#1c2b22", color: "#8dcdb0", border: "1px dashed #2a3d31" }}
            >
              {scanning ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              {scanning ? "Lendo cupom..." : "Escanear cupom (foto ou imagem)"}
            </button>
            {scanError && (
              <p className="text-[11px] mt-1.5" style={{ color: "#f59e0b" }}>
                {scanError}
              </p>
            )}
            {scanSource && (
              <p className="text-[11px] mt-1.5" style={{ color: "#8dcdb0" }}>
                Lido por IA — confira os itens antes de salvar.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                Descrição *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 rounded bg-[#0f1a15] text-sm"
                placeholder="Supermercado, iFood..."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                Valor total *
              </label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="w-full p-2 rounded bg-[#0f1a15] text-sm"
                placeholder="42,90"
                required
              />
            </div>

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

            <div className="col-span-2">
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

          {/* Itens (produtos) */}
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
    </>
  );
}
