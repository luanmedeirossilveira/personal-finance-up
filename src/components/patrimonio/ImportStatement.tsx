"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import ModalPortal from "@/components/ui/ModalPortal";
import showToast from "@/components/ui/toast";
import { BILL_CATEGORIES } from "@/lib/db/schema";
import { BRL, formatDateBR } from "@/lib/month";

interface PreviewTx {
  externalId: string;
  date: string;
  amount: number;
  description: string;
  category: string | null;
  duplicate: boolean;
}

// Importar extrato OFX/CSV: lê, mostra prévia com categorias sugeridas, tira duplicadas e salva.
export default function ImportStatement({
  account,
  onClose,
  onDone,
}: Readonly<{ account: { id: number; name: string }; onClose: () => void; onDone: () => void }>) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewTx[] | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(commit: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("accountId", String(account.id));
    if (commit) {
      form.append("commit", "true");
      form.append("skip", Array.from(skip).join(","));
      form.append("categories", JSON.stringify(categories));
    }
    const res = await fetch("/api/import", { method: "POST", body: form });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Falha ao ler o arquivo.");
      return;
    }
    if (commit) {
      showToast(`${body.saved} transações importadas${body.matched ? `, ${body.matched} casadas com contas` : ""}.`);
      onDone();
    } else {
      setPreview(body.transactions);
      setSkip(new Set());
      setCategories(Object.fromEntries(body.transactions.map((t: PreviewTx) => [t.externalId, t.category ?? ""])));
    }
  }

  const fresh = preview?.filter((t) => !t.duplicate) ?? [];
  const toSave = fresh.filter((t) => !skip.has(t.externalId)).length;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-50 flex justify-center items-end sm:items-center sm:p-4">
        <div className="card w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-b-none sm:rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-lg font-bold">Importar extrato</h3>
            <p className="text-sm" style={{ color: "rgb(var(--text-muted))" }}>
              {account.name} · OFX ou CSV. Duplicadas são detectadas automaticamente.
            </p>
          </div>

          <label
            className="flex items-center justify-center gap-2 p-5 rounded-xl cursor-pointer text-sm"
            style={{ border: "1.5px dashed rgb(var(--border))", color: "rgb(var(--text-soft))" }}
          >
            <Upload size={16} />
            {file ? file.name : "Escolher arquivo .ofx ou .csv"}
            <input
              type="file"
              accept=".ofx,.csv,text/csv,application/x-ofx"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
          </label>

          {error && (
            <p className="text-sm" style={{ color: "rgb(var(--negative))" }}>
              {error}
            </p>
          )}

          {preview && (
            <div className="space-y-2">
              <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                {preview.length} lidas · {preview.length - fresh.length} já importadas · {toSave} serão salvas
              </div>
              <ul className="divide-y divide-line max-h-80 overflow-y-auto">
                {preview.map((t) => {
                  const off = t.duplicate || skip.has(t.externalId);
                  return (
                    <li key={t.externalId} className="flex items-center gap-2 py-2" style={{ opacity: off ? 0.45 : 1 }}>
                      <input
                        type="checkbox"
                        checked={!off}
                        disabled={t.duplicate}
                        onChange={() =>
                          setSkip((prev) => {
                            const next = new Set(prev);
                            if (next.has(t.externalId)) next.delete(t.externalId);
                            else next.add(t.externalId);
                            return next;
                          })
                        }
                        aria-label="Importar"
                        className="accent-[rgb(var(--accent-strong))]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{t.description}</div>
                        <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                          {formatDateBR(t.date)}
                          {t.duplicate ? " · já importada" : ""}
                        </div>
                      </div>
                      <select
                        value={categories[t.externalId] ?? ""}
                        disabled={off}
                        onChange={(e) => setCategories((prev) => ({ ...prev, [t.externalId]: e.target.value }))}
                        className="text-xs rounded-lg px-1.5 py-1 w-28"
                        style={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))" }}
                        aria-label="Categoria"
                      >
                        <option value="">sem categoria</option>
                        {BILL_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <span
                        className="text-sm font-numeric w-24 text-right"
                        style={{ color: t.amount < 0 ? "rgb(var(--text))" : "rgb(var(--accent))" }}
                      >
                        {t.amount < 0 ? "-" : "+"}
                        {BRL(Math.abs(t.amount))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "rgb(var(--surface-raised))", color: "rgb(var(--text-soft))", border: "1px solid rgb(var(--border))" }}
            >
              Cancelar
            </button>
            <button
              onClick={() => send(Boolean(preview))}
              disabled={!file || busy || (preview !== null && toSave === 0)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
            >
              {busy ? "Processando..." : preview ? `Importar ${toSave}` : "Ler arquivo"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
