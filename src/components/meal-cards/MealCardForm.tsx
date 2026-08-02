// src/components/meal-cards/MealCardForm.tsx
"use client";

import { useState } from "react";
import type { MealCard } from "./MealCardsManager";
import ModalPortal from "@/components/ui/ModalPortal";

const COLORS = ["#5ab28d", "#f59e0b", "#3b82f6", "#a855f7", "#ec4899", "#ef4444"];

export default function MealCardForm({
  card,
  month,
  year,
  onClose,
  onSave,
}: Readonly<{
  card?: MealCard | null;
  month: number;
  year: number;
  onClose: () => void;
  onSave: () => void;
}>) {
  const [name, setName] = useState(card?.name || "");
  const [limitAmount, setLimitAmount] = useState(
    card?.limitAmount ? String(card.limitAmount) : "",
  );
  const [color, setColor] = useState(card?.color || COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name: name.trim(),
      limitAmount: Number.parseFloat((limitAmount || "0").replace(",", ".")) || 0,
      color,
      month,
      year,
    };

    if (card) {
      await fetch(`/api/meal-cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`/api/meal-cards`, {
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
            {card ? "Editar cartão" : "Novo cartão alimentação"}
          </h4>

          <div className="space-y-3">
            <div>
              <label
                className="block text-xs font-medium mb-1 uppercase tracking-wide"
                style={{ color: "#8dcdb0" }}
              >
                Nome do cartão *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 rounded bg-[#0f1a15] text-sm"
                placeholder="Alelo, Sodexo, VR..."
                required
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1 uppercase tracking-wide"
                style={{ color: "#8dcdb0" }}
              >
                Limite do mês
              </label>
              <input
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                inputMode="decimal"
                className="w-full p-2 rounded bg-[#0f1a15] text-sm"
                placeholder="800,00"
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-2 uppercase tracking-wide"
                style={{ color: "#8dcdb0" }}
              >
                Cor
              </label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full transition-transform active:scale-90"
                    style={{
                      background: c,
                      outline: color === c ? "2px solid #f0f9f4" : "none",
                      outlineOffset: "2px",
                    }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
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
              {saving ? "Salvando..." : card ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
