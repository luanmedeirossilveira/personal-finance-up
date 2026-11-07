"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import showConfirm from "@/components/ui/confirm";
import showToast from "@/components/ui/toast";
import { BRL, statusColor } from "@/lib/month";
import type { CardUsage } from "@/lib/cards";

interface CreditAccount {
  id: number;
  name: string;
  number: string | null;
  type: string;
}

const OWNER_LABEL = { mine: "seu", hers: "dela", joint: "conjunto" } as const;
const selectStyle = { background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))" } as const;

// Limite planejado por cartão (seu e dela). O uso é a soma das faturas do mês que o cartão reconhece
// pelas palavras do nome (ex.: "itau", "inter"). Não entra no patrimônio.
export default function CardPlans({ month, year, refreshKey }: Readonly<{ month: number; year: number; refreshKey?: string | number }>) {
  const [cards, setCards] = useState<CardUsage[] | null>(null);
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [editing, setEditing] = useState<Record<number, { monthlyLimit: string; matchTerms: string }>>({});
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ name: "", ownership: "mine", monthlyLimit: "", matchTerms: "", accountId: "" });

  const load = useCallback(async () => {
    const [c, a] = await Promise.all([fetch(`/api/cards?month=${month}&year=${year}`), fetch("/api/accounts")]);
    setCards(c.ok ? await c.json() : []);
    setAccounts(a.ok ? ((await a.json()).accounts ?? []).filter((x: CreditAccount) => x.type === "credit") : []);
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const num = (v: string) => Number.parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;

  async function save(body: Record<string, unknown>, method: "POST" | "PATCH") {
    const res = await fetch("/api/cards", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      showToast("Não foi possível salvar o cartão (a migration 0021 foi aplicada?).");
      return false;
    }
    await load();
    return true;
  }

  async function saveEdit(c: CardUsage) {
    if (c.id === null) return;
    const e = editing[c.id];
    if (!e) return;
    setEditing(({ [c.id as number]: _, ...rest }) => rest);
    await save({ id: c.id, monthlyLimit: num(e.monthlyLimit), matchTerms: e.matchTerms }, "PATCH");
  }

  async function create() {
    if (!draft.name.trim()) return;
    const ok = await save(
      {
        name: draft.name.trim(),
        ownership: draft.ownership,
        monthlyLimit: num(draft.monthlyLimit),
        matchTerms: draft.matchTerms || draft.name,
        accountId: draft.accountId ? Number(draft.accountId) : null,
      },
      "POST",
    );
    if (ok) {
      setShowNew(false);
      setDraft({ name: "", ownership: "mine", monthlyLimit: "", matchTerms: "", accountId: "" });
    }
  }

  async function remove(c: CardUsage) {
    if (c.id === null || !(await showConfirm(`Remover o planejado de "${c.name}"? As faturas continuam no Mês.`))) return;
    await fetch(`/api/cards?id=${c.id}`, { method: "DELETE" });
    load();
  }

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard size={16} style={{ color: "rgb(var(--text-soft))" }} />
          <h3 className="text-sm font-bold">Cartões — limite planejado</h3>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: "rgb(var(--accent))" }}>
          <Plus size={14} /> Cartão
        </button>
      </div>

      {showNew && (
        <div className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_1fr_9rem_auto] p-3 rounded-xl" style={{ background: "rgb(var(--surface-raised))" }}>
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Nome (ex.: Itaú)" className="input-base !py-2 text-sm" />
          <select value={draft.ownership} onChange={(e) => setDraft((d) => ({ ...d, ownership: e.target.value }))} className="rounded-lg px-2 text-sm" style={selectStyle}>
            <option value="mine">seu</option>
            <option value="hers">dela</option>
            <option value="joint">conjunto</option>
          </select>
          <input value={draft.monthlyLimit} onChange={(e) => setDraft((d) => ({ ...d, monthlyLimit: e.target.value }))} placeholder="Limite/mês" inputMode="decimal" className="input-base !py-2 text-sm text-right" />
          <input value={draft.matchTerms} onChange={(e) => setDraft((d) => ({ ...d, matchTerms: e.target.value }))} placeholder="Palavras da fatura (ex.: itau)" className="input-base !py-2 text-sm" />
          <select value={draft.accountId} onChange={(e) => setDraft((d) => ({ ...d, accountId: e.target.value }))} className="rounded-lg px-2 text-sm" style={selectStyle} aria-label="Conta do banco">
            <option value="">sem conta do banco</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.number ? ` ••${a.number}` : ""}
              </option>
            ))}
          </select>
          <button onClick={create} disabled={!draft.name.trim()} className="px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}>
            Salvar
          </button>
        </div>
      )}

      {cards === null ? (
        <p className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
          Carregando...
        </p>
      ) : cards.length === 0 ? (
        <p className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
          Nenhuma fatura de cartão neste mês e nenhum cartão planejado.
        </p>
      ) : (
        <ul className="space-y-3">
          {cards.map((c) => {
            const e = c.id !== null ? editing[c.id] : undefined;
            return (
              <li key={c.id ?? `x-${c.name}`} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold flex-1 min-w-0 truncate">
                    {c.name}
                    <span className="text-xs font-normal ml-1.5" style={{ color: "rgb(var(--text-muted))" }}>
                      {OWNER_LABEL[c.ownership]}
                      {c.id === null && " · sem planejado"}
                    </span>
                  </span>
                  <span className="text-sm font-numeric">{BRL(c.used)}</span>
                  {c.id !== null ? (
                    <>
                      <span className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                        /
                      </span>
                      <input
                        value={e?.monthlyLimit ?? c.monthlyLimit.toFixed(2).replace(".", ",")}
                        onChange={(ev) =>
                          setEditing((p) => ({ ...p, [c.id as number]: { monthlyLimit: ev.target.value, matchTerms: e?.matchTerms ?? c.matchTerms.join(", ") } }))
                        }
                        onBlur={() => saveEdit(c)}
                        onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
                        inputMode="decimal"
                        aria-label={`Limite planejado de ${c.name}`}
                        className="input-base !w-24 !py-1 !px-2 text-right tabular text-xs"
                      />
                      <button onClick={() => remove(c)} aria-label="Remover cartão planejado" className="p-1" style={{ color: "rgb(var(--text-muted))" }}>
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setDraft({ name: c.name, ownership: c.ownership, monthlyLimit: "", matchTerms: c.name, accountId: "" });
                        setShowNew(true);
                      }}
                      className="text-xs font-semibold"
                      style={{ color: "rgb(var(--accent))" }}
                    >
                      planejar
                    </button>
                  )}
                </div>
                {c.monthlyLimit > 0 && (
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgb(var(--border))" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min((c.ratio ?? 0) * 100, 100)}%`, background: statusColor(c.ratio ?? 0) }} />
                  </div>
                )}
                <div className="flex flex-wrap gap-x-3 text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
                  {c.monthlyLimit > 0 && (
                    <span style={{ color: c.ratio !== null && c.ratio > 1 ? "rgb(var(--negative))" : undefined }}>
                      {c.ratio !== null && c.ratio > 1 ? `${BRL(c.used - c.monthlyLimit)} acima do planejado` : `restam ${BRL(c.monthlyLimit - c.used)}`}
                    </span>
                  )}
                  {c.bills.length > 0 && <span>faturas: {c.bills.map((b) => b.name).join(", ")}</span>}
                  {c.id !== null && c.bills.length === 0 && <span>nenhuma fatura reconhecida por “{c.matchTerms.join(", ")}” neste mês</span>}
                  {c.id !== null && (
                    <input
                      value={e?.matchTerms ?? c.matchTerms.join(", ")}
                      onChange={(ev) =>
                        setEditing((p) => ({
                          ...p,
                          [c.id as number]: { monthlyLimit: e?.monthlyLimit ?? String(c.monthlyLimit).replace(".", ","), matchTerms: ev.target.value },
                        }))
                      }
                      onBlur={() => saveEdit(c)}
                      aria-label={`Palavras que identificam as faturas de ${c.name}`}
                      title="Palavras que identificam as faturas deste cartão no Mês"
                      className="bg-transparent border-b border-dashed text-[11px] px-0.5 w-32"
                      style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text-soft))" }}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
