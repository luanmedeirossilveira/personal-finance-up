"use client";

import { useState } from "react";
import { Eye, EyeOff, Link2, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import showConfirm from "@/components/ui/confirm";
import showToast from "@/components/ui/toast";
import { BRL, formatDateBR } from "@/lib/month";
import type { Account } from "@/lib/db/schema";
import ImportStatement from "./ImportStatement";
import type { PatrimonioData } from "./usePatrimonio";

const TYPE_LABEL: Record<Account["type"], string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit: "Cartão de crédito",
  meal: "Alimentação",
  investment: "Investimento",
};
const OWNER_LABEL: Record<Account["ownership"], string> = { mine: "minha", hers: "dela", joint: "conjunta" };

// Patrimônio › Contas: saldos por conta (Pluggy ou manual), conexão MeuPluggy, importação de extrato
// (Os cartões alimentação ficam no Mês, junto dos gastos do mês.)
export default function AccountsTab({ data, reload }: Readonly<{ data: PatrimonioData; reload: () => Promise<void> }>) {
  const [syncing, setSyncing] = useState(false);
  const [itemId, setItemId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [importFor, setImportFor] = useState<{ id: number; name: string } | null>(null);
  const [editing, setEditing] = useState<Record<number, string>>({});

  async function sync() {
    setSyncing(true);
    const res = await fetch("/api/pluggy/sync", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setSyncing(false);
    showToast(
      res.ok
        ? `${body.transactions ?? 0} transações lidas${body.matched ? `, ${body.matched} pagamentos detectados` : ""}.`
        : "Falha ao sincronizar.",
    );
    if (body.errors?.length) console.warn("Pluggy:", body.errors);
    reload();
  }

  async function connect() {
    setConnecting(true);
    const res = await fetch("/api/pluggy/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    const body = await res.json().catch(() => ({}));
    setConnecting(false);
    if (!res.ok) {
      showToast(body.error ?? "Não foi possível conectar.");
      return;
    }
    setItemId("");
    showToast(`Conectado: ${body.accounts ?? 0} contas sincronizadas.`);
    reload();
  }

  async function removeItem(id: number) {
    if (!(await showConfirm("Remover esta conexão? As contas já sincronizadas ficam como histórico."))) return;
    await fetch(`/api/pluggy/items?id=${id}`, { method: "DELETE" });
    reload();
  }

  async function saveBalance(acc: Account) {
    const raw = editing[acc.id];
    if (raw === undefined) return;
    const balance = Number.parseFloat(raw.replace(/\./g, "").replace(",", "."));
    setEditing(({ [acc.id]: _, ...rest }) => rest);
    if (!Number.isFinite(balance) || balance === acc.balance) return;
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: acc.id, balance }),
    });
    reload();
  }

  async function removeAccount(acc: Account) {
    if (!(await showConfirm(`Remover a conta "${acc.name}"? As transações importadas dela também saem.`))) return;
    await fetch(`/api/accounts?id=${acc.id}`, { method: "DELETE" });
    reload();
  }

  async function setHidden(acc: Account, archived: boolean) {
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: acc.id, archived }),
    });
    reload();
  }

  // Cartões ficam fora: são limite planejado (Mês/Revisão), não patrimônio.
  const accounts = data.accounts.filter((a) => a.type !== "investment" && a.type !== "credit" && !a.archived);
  const creditCards = data.accounts.filter((a) => a.type === "credit" && !a.archived);
  const hidden = data.accounts.filter((a) => a.archived);

  return (
    <div className="space-y-5">
      {/* Conexão Open Finance */}
      <section className="card p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">Open Finance (MeuPluggy)</h3>
            <p className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
              {data.pluggyConfigured
                ? "Saldo e transações das suas contas, atualizados todo dia."
                : "Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no ambiente para ativar."}
            </p>
          </div>
          {data.items.length > 0 && (
            <button
              onClick={sync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
              style={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text-soft))" }}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Sincronizando..." : "Sincronizar agora"}
            </button>
          )}
        </div>

        {data.items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 text-sm rounded-xl px-3 py-2" style={{ background: "rgb(var(--surface-raised))" }}>
            <Link2 size={14} style={{ color: it.lastError ? "rgb(var(--negative))" : "rgb(var(--accent))" }} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{it.connectorName ?? "Conexão"}</div>
              <div className="text-xs truncate" style={{ color: it.lastError ? "rgb(var(--negative))" : "rgb(var(--text-muted))" }}>
                {it.lastError ?? (it.lastSyncAt ? `última sincronização ${new Date(it.lastSyncAt).toLocaleString("pt-BR")}` : "aguardando sincronização")}
              </div>
            </div>
            <button onClick={() => removeItem(it.id)} aria-label="Remover conexão" className="p-1.5" style={{ color: "rgb(var(--text-muted))" }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {data.pluggyConfigured && (
          <div className="flex gap-2">
            <input
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              placeholder="itemId do MeuPluggy (dashboard.pluggy.ai)"
              className="input-base flex-1 !py-2 text-sm"
            />
            <button
              onClick={connect}
              disabled={connecting || itemId.trim().length < 36}
              className="px-4 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
            >
              {connecting ? "Conectando..." : "Conectar"}
            </button>
          </div>
        )}
      </section>

      {/* Contas */}
      <section className="card p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Contas</h3>
          <button onClick={() => setShowNew((v) => !v)} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "rgb(var(--accent))" }}>
            <Plus size={15} /> Conta manual
          </button>
        </div>

        {showNew && (
          <NewAccountForm
            onSaved={() => {
              setShowNew(false);
              reload();
            }}
          />
        )}

        {accounts.length === 0 ? (
          <p className="text-sm py-2" style={{ color: "rgb(var(--text-muted))" }}>
            Nenhuma conta ainda. Conecte pelo Open Finance ou crie uma conta manual (ex.: a conta dela, para importar extrato).
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {accounts.map((acc) => (
              <li key={acc.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {acc.name}
                    {acc.number && <span style={{ color: "rgb(var(--text-muted))" }}> •••• {acc.number}</span>}
                  </div>
                  <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                    {TYPE_LABEL[acc.type]} · {OWNER_LABEL[acc.ownership]} · {acc.source === "pluggy" ? "Open Finance" : "manual"}
                    {acc.lastImportAt && ` · extrato ${new Date(acc.lastImportAt).toLocaleDateString("pt-BR")}`}
                  </div>
                </div>
                {acc.source === "manual" ? (
                  <input
                    value={editing[acc.id] ?? acc.balance.toFixed(2).replace(".", ",")}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [acc.id]: e.target.value }))}
                    onBlur={() => saveBalance(acc)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    inputMode="decimal"
                    aria-label={`Saldo de ${acc.name}`}
                    className="input-base !w-32 !py-1.5 text-right tabular text-sm"
                  />
                ) : (
                  <span className="text-sm font-numeric" style={{ color: acc.type === "credit" ? "rgb(var(--negative))" : "rgb(var(--text))" }}>
                    {acc.type === "credit" ? `-${BRL(Math.abs(acc.balance))}` : BRL(acc.balance)}
                  </span>
                )}
                {acc.source === "manual" && acc.type !== "meal" && (
                  <button
                    onClick={() => setImportFor({ id: acc.id, name: acc.name })}
                    aria-label="Importar extrato"
                    title="Importar extrato OFX/CSV"
                    className="p-1.5 rounded-lg hover:bg-fg/5"
                    style={{ color: "rgb(var(--text-soft))" }}
                  >
                    <Upload size={15} />
                  </button>
                )}
                <button
                  onClick={() => setHidden(acc, true)}
                  aria-label="Ocultar conta"
                  title="Ocultar (não uso esta conta)"
                  className="p-1.5 rounded-lg hover:bg-fg/5"
                  style={{ color: "rgb(var(--text-muted))" }}
                >
                  <EyeOff size={14} />
                </button>
                {acc.source === "manual" && (
                  <button onClick={() => removeAccount(acc)} aria-label="Remover conta" className="p-1.5 rounded-lg hover:bg-fg/5" style={{ color: "rgb(var(--text-muted))" }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {creditCards.length > 0 && (
        <section className="card p-4 md:p-5 space-y-2">
          <div>
            <h3 className="text-base font-bold">Cartões do Open Finance</h3>
            <p className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
              Não entram no patrimônio: o limite de cada cartão é planejado em Mês › Categorias.
            </p>
          </div>
          <ul className="divide-y divide-line">
            {creditCards.map((acc) => (
              <li key={acc.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {acc.name}
                    {acc.number && <span style={{ color: "rgb(var(--text-muted))" }}> •••• {acc.number}</span>}
                  </div>
                  <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                    limite usado {BRL(acc.balance)}
                    {acc.billDueDate && ` · vence ${formatDateBR(acc.billDueDate)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="label-sm">fatura em aberto</div>
                  <div className="text-sm font-numeric">{acc.openBillAmount !== null ? BRL(acc.openBillAmount) : "—"}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hidden.length > 0 && (
        <details className="card p-4 md:p-5">
          <summary className="text-sm font-semibold cursor-pointer" style={{ color: "rgb(var(--text-soft))" }}>
            Contas ocultas ({hidden.length})
          </summary>
          <ul className="divide-y divide-line mt-2">
            {hidden.map((acc) => (
              <li key={acc.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 min-w-0 text-sm truncate">
                  {acc.name} <span style={{ color: "rgb(var(--text-muted))" }}>· {TYPE_LABEL[acc.type]}</span>
                </span>
                <span className="text-sm font-numeric" style={{ color: "rgb(var(--text-muted))" }}>
                  {BRL(acc.balance)}
                </span>
                <button onClick={() => setHidden(acc, false)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: "rgb(var(--accent))" }}>
                  <Eye size={13} /> mostrar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {importFor && (
        <ImportStatement
          account={importFor}
          onClose={() => setImportFor(null)}
          onDone={() => {
            setImportFor(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function NewAccountForm({ onSaved }: Readonly<{ onSaved: () => void }>) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("checking");
  const [ownership, setOwnership] = useState<Account["ownership"]>("hers");
  const [balance, setBalance] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type,
        ownership,
        balance: Number.parseFloat(balance.replace(/\./g, "").replace(",", ".")) || 0,
      }),
    });
    setSaving(false);
    onSaved();
  }

  const selectStyle = { background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))" };

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_9rem_7rem_7rem_auto] p-3 rounded-xl" style={{ background: "rgb(var(--surface-raised))" }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex.: Nubank dela)" className="input-base !py-2 text-sm" />
      <select value={type} onChange={(e) => setType(e.target.value as Account["type"])} className="rounded-lg px-2 text-sm" style={selectStyle}>
        {(["checking", "savings", "credit"] as const).map((t) => (
          <option key={t} value={t}>
            {TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <select value={ownership} onChange={(e) => setOwnership(e.target.value as Account["ownership"])} className="rounded-lg px-2 text-sm" style={selectStyle}>
        {(["hers", "mine", "joint"] as const).map((o) => (
          <option key={o} value={o}>
            {OWNER_LABEL[o]}
          </option>
        ))}
      </select>
      <input value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Saldo" inputMode="decimal" className="input-base !py-2 text-sm text-right" />
      <button
        onClick={save}
        disabled={saving || !name.trim()}
        className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
      >
        Salvar
      </button>
    </div>
  );
}
