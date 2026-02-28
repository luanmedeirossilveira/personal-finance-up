"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Salary {
  id?: number;
  person: string;
  amount: number;
}

const BRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function SalariesManager({
  month: propMonth,
  year: propYear,
  onClose,
  onSave,
}: {
  month?: number;
  year?: number;
  onClose?: () => void;
  onSave?: () => void;
}) {
  const searchParams = useSearchParams();
  const now = new Date();
  const month = propMonth ?? parseInt(searchParams.get("month") || String(now.getMonth() + 1));
  const year = propYear ?? parseInt(searchParams.get("year") || String(now.getFullYear()));

  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/salaries?month=${month}&year=${year}`);
    if (res.ok) {
      const data = await res.json();
      setSalaries(data.map((s: any) => ({ id: s.id, person: s.person, amount: s.amount })));
    } else {
      setSalaries([]);
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function updateRow(index: number, patch: Partial<Salary>) {
    setSalaries((prev) => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
  }

  function addRow() {
    setSalaries((prev) => [...prev, { person: "", amount: 0 }]);
  }

  function removeRow(index: number) {
    setSalaries((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    // Prepare payload - send only non-empty person rows
    const payload = {
      salaries: salaries.filter(s => s.person.trim() !== "").map(s => ({ person: s.person.trim(), amount: Number(s.amount) })),
      month,
      year,
    };

    await fetch(`/api/salaries`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    await fetchData();
    if (onSave) onSave();
  }

  if (loading) {
    return <div className="card p-4">Carregando rendas...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black">Rendas — {month}/{year}</h3>
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">Total: {BRL(salaries.reduce((s, r) => s + Number(r.amount), 0))}</div>
          {onClose && (
            <button onClick={onClose} className="text-sm px-3 py-1 rounded-md" style={{ background: "#1c2b22", color: "#8dcdb0" }}>Fechar</button>
          )}
        </div>
      </div>

      <div className="card p-4 space-y-3">
        {salaries.length === 0 && (
          <div className="text-sm" style={{ color: "#8dcdb0" }}>Nenhuma renda para este mês. Adicione abaixo.</div>
        )}

        <div className="space-y-2">
          {salaries.map((s, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                value={s.person}
                onChange={(e) => updateRow(idx, { person: e.target.value })}
                placeholder="Pessoa"
                className="input-base w-96 flex-1"
              />
              <input
                value={String(s.amount)}
                onChange={(e) => updateRow(idx, { amount: parseFloat(e.target.value.replace(",", ".")) || 0 })}
                placeholder="0,00"
                className="input-base w-32 flex-1 text-right"
              />
              <button type="button" onClick={() => removeRow(idx)} className="px-3 py-2 rounded-md text-sm" style={{ background: "#1c2b22", color: "#8dcdb0" }}>Remover</button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={addRow} className="flex-1 py-2 rounded-xl" style={{ background: "#389671", color: "#fff" }}>Adicionar renda</button>
          <button type="button" onClick={save} disabled={saving} className="flex-1 py-2 rounded-xl" style={{ background: "#1c2b22", color: "#8dcdb0", border: "1px solid #2a3d31" }}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
