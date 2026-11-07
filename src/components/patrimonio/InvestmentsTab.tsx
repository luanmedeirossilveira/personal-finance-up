"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import showConfirm from "@/components/ui/confirm";
import { INVESTMENT_TYPES, type Investment } from "@/lib/db/schema";
import { BRL, formatDateBR } from "@/lib/month";
import type { PatrimonioData } from "./usePatrimonio";

const TYPE_LABEL: Record<string, string> = {
  cdb: "CDB",
  tesouro: "Tesouro Direto",
  lci_lca: "LCI / LCA",
  fundo: "Fundos",
  acao: "Ações e ETFs",
  previdencia: "Previdência",
  outro: "Outros",
};

// Patrimônio › Investimentos: posições agrupadas por tipo, aplicado vs. saldo.
export default function InvestmentsTab({ data, reload }: Readonly<{ data: PatrimonioData; reload: () => Promise<void> }>) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Record<number, string>>({});

  const groups = INVESTMENT_TYPES.map((type) => ({
    type,
    items: data.investments.filter((i) => i.type === type),
  })).filter((g) => g.items.length > 0);

  const applied = data.investments.reduce((s, i) => s + i.appliedAmount, 0);
  const balance = data.investments.reduce((s, i) => s + i.balance, 0);
  const gain = balance - applied;

  async function saveBalance(inv: Investment) {
    const raw = editing[inv.id];
    if (raw === undefined) return;
    const value = Number.parseFloat(raw.replace(/\./g, "").replace(",", "."));
    setEditing(({ [inv.id]: _, ...rest }) => rest);
    if (!Number.isFinite(value) || value === inv.balance) return;
    await fetch("/api/investments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: inv.id, balance: value }),
    });
    reload();
  }

  async function remove(inv: Investment) {
    if (!(await showConfirm(`Remover "${inv.name}"?`))) return;
    await fetch(`/api/investments?id=${inv.id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <div className="label-sm">Saldo investido</div>
          <div className="text-3xl font-numeric mt-1">{BRL(balance)}</div>
        </div>
        <div>
          <div className="label-sm">Aplicado</div>
          <div className="text-base font-numeric mt-1" style={{ color: "rgb(var(--text-soft))" }}>
            {BRL(applied)}
          </div>
        </div>
        <div>
          <div className="label-sm">Rendimento</div>
          <div className="text-base font-numeric mt-1" style={{ color: gain >= 0 ? "rgb(var(--accent))" : "rgb(var(--negative))" }}>
            {gain >= 0 ? "+" : ""}
            {BRL(gain)}
            {applied > 0 && <span className="text-xs ml-1">({((gain / applied) * 100).toFixed(1)}%)</span>}
          </div>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="ml-auto flex items-center gap-1 text-sm font-semibold" style={{ color: "rgb(var(--accent))" }}>
          <Plus size={15} /> Investimento manual
        </button>
      </div>

      {data.pluggyConfigured && data.items.length === 0 && (
        <div className="card p-4 text-sm" style={{ borderLeft: "3px solid rgb(var(--warning))", color: "rgb(var(--text-soft))" }}>
          Nenhuma conexão do Open Finance ativa. Os investimentos do Itaú chegam pela conexão do MeuPluggy: cole o itemId em
          Patrimônio › Contas e sincronize.
        </div>
      )}
      {data.items.some((i) => i.lastError) && (
        <div className="card p-4 text-xs" style={{ color: "rgb(var(--negative))" }}>
          Última sincronização com erro: {data.items.find((i) => i.lastError)?.lastError}
        </div>
      )}

      {showNew && (
        <NewInvestmentForm
          onSaved={() => {
            setShowNew(false);
            reload();
          }}
        />
      )}

      {groups.length === 0 ? (
        <div className="card p-6 text-sm" style={{ color: "rgb(var(--text-muted))" }}>
          Nenhum investimento ainda. Se o conector do Open Finance trouxer posições, elas aparecem aqui sozinhas; senão, cadastre à
          mão e atualize o saldo na Revisão mensal. Para somar aportes automaticamente, vincule a conta mensal de investimento a uma
          posição no formulário de conta.
        </div>
      ) : (
        groups.map((g) => {
          const total = g.items.reduce((s, i) => s + i.balance, 0);
          return (
            <section key={g.type} className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold">{TYPE_LABEL[g.type]}</h3>
                <span className="text-sm font-numeric">{BRL(total)}</span>
              </div>
              <ul className="divide-y divide-line">
                {g.items.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{inv.name}</div>
                      <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                        aplicado {BRL(inv.appliedAmount)}
                        {inv.dueDate && ` · vence ${formatDateBR(inv.dueDate)}`}
                        {inv.source === "pluggy" && " · Open Finance"}
                      </div>
                    </div>
                    {inv.source === "manual" ? (
                      <input
                        value={editing[inv.id] ?? inv.balance.toFixed(2).replace(".", ",")}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                        onBlur={() => saveBalance(inv)}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        inputMode="decimal"
                        aria-label={`Saldo de ${inv.name}`}
                        className="input-base !w-32 !py-1.5 text-right tabular text-sm"
                      />
                    ) : (
                      <span className="text-sm font-numeric">{BRL(inv.balance)}</span>
                    )}
                    {inv.source === "manual" && (
                      <button onClick={() => remove(inv)} aria-label="Remover" className="p-1.5" style={{ color: "rgb(var(--text-muted))" }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function NewInvestmentForm({ onSaved }: Readonly<{ onSaved: () => void }>) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("cdb");
  const [applied, setApplied] = useState("");
  const [balance, setBalance] = useState("");
  const [dueDate, setDueDate] = useState("");
  const num = (v: string) => Number.parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;

  async function save() {
    if (!name.trim()) return;
    await fetch("/api/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type,
        appliedAmount: num(applied),
        balance: balance ? num(balance) : num(applied),
        dueDate: dueDate || null,
      }),
    });
    onSaved();
  }

  return (
    <div className="card p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_9rem_8rem_8rem_9rem_auto]">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex.: CDB Inter 110%)" className="input-base !py-2 text-sm" />
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="rounded-lg px-2 py-2 text-sm"
        style={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))" }}
      >
        {INVESTMENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <input value={applied} onChange={(e) => setApplied(e.target.value)} placeholder="Aplicado" inputMode="decimal" className="input-base !py-2 text-sm text-right" />
      <input value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Saldo atual" inputMode="decimal" className="input-base !py-2 text-sm text-right" />
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Vencimento" className="input-base !py-2 text-sm" />
      <button
        onClick={save}
        disabled={!name.trim()}
        className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
      >
        Salvar
      </button>
    </div>
  );
}
