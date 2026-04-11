"use client";

import { useState } from "react";

interface CardTransaction {
  id: number;
  name: string;
  amount: number;
  installment?: string | null;
  category?: string | null;
  date?: string | null;
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
  const [name, setName] = useState(transaction?.name || "");
  const [amount, setAmount] = useState(transaction?.amount?.toString() || "");
  const [installment, setInstallment] = useState(transaction?.installment || "");
  const [category, setCategory] = useState(transaction?.category || "");
  const [date, setDate] = useState(transaction?.date || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name: name.trim().toUpperCase(),
      amount: Number.parseFloat(amount.replace(",", ".")),
      installment: installment || null,
      category: category || null,
      date: date || null,
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

            <div>
              <label className="block text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
                Valor *
              </label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
