"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Chip from "@/components/ui/Chip";
import ModalPortal from "@/components/ui/ModalPortal";
import showConfirm from "@/components/ui/confirm";
import { BRL, formatDateBR } from "@/lib/month";
import { categoryLabel, normalizeCategory } from "@/lib/categories";
import {
  type CardTxKind,
  filterCardTransactions,
  isCardTxFilterActive,
  moveItem,
  summarizeChecked,
} from "@/lib/card-transactions-shared";
import CardTransactionForm from "./CardTransactionForm";
import { type CardTransaction, useCardTransactions } from "./useCardTransactions";

const KIND_CHIPS: { value: CardTxKind; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "avista", label: "À vista" },
  { value: "parcelada", label: "Parcelada" },
  { value: "recorrente", label: "Recorrente" },
];

const fmtQty = (q: number) =>
  Number.isInteger(q) ? String(q) : q.toLocaleString("pt-BR");

// Fatura do cartão em tela cheia: busca, filtros, conferência contra o app do banco
// e ordem manual (para ler as duas listas na mesma sequência).
export default function CardBillSheet({
  bill,
  locked = false,
  onClose,
  onTotalChange,
}: Readonly<{
  bill: { id: number; name: string; cardLast4?: string | null };
  /** Mês fechado: só leitura (busca e filtros continuam). */
  locked?: boolean;
  onClose: () => void;
  onTotalChange?: (total: number) => void;
}>) {
  const { transactions, loading, loadError, fetchTransactions, toggleChecked, deleteTransaction, saveOrder } =
    useCardTransactions(bill.id, onTotalChange);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CardTxKind>("all");
  const [onlyUnchecked, setOnlyUnchecked] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editTransaction, setEditTransaction] = useState<CardTransaction | null>(null);

  // Modo reordenar: edita um rascunho e só grava no "Concluir".
  const [draft, setDraft] = useState<CardTransaction[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Trava o scroll da página por trás da folha.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const filter = { query, kind, onlyUnchecked };
  const filterActive = isCardTxFilterActive(filter);
  const reordering = draft !== null;
  const visible = reordering ? draft : filterCardTransactions(transactions, filter);
  const hasManualOrder = transactions.some((t) => t.position != null);

  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const visibleTotal = visible.reduce((s, t) => s + t.amount, 0);
  const summary = summarizeChecked(transactions);

  function clearFilters() {
    setQuery("");
    setKind("all");
    setOnlyUnchecked(false);
  }

  async function handleDelete(t: CardTransaction) {
    if (!(await showConfirm(`Remover "${t.name}"?`))) return;
    deleteTransaction(t.id);
  }

  async function finishReorder() {
    if (!draft) return;
    setSavingOrder(true);
    const ok = await saveOrder(draft.map((t) => t.id));
    setSavingOrder(false);
    if (ok) setDraft(null);
  }

  async function resetOrder() {
    if (!(await showConfirm("Voltar à ordem por data (mais recente primeiro)?"))) return;
    setSavingOrder(true);
    const ok = await saveOrder([]);
    setSavingOrder(false);
    if (ok) setDraft(null);
  }

  // Arrastar pela alça: a linha sob o dedo/cursor vira o destino. Pointer events
  // funcionam com toque e mouse; `touch-action: none` na alça evita o scroll.
  function onGripDown(e: React.PointerEvent, id: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragId(id);
  }

  function onGripMove(e: React.PointerEvent) {
    if (dragId === null || !draft) return;
    const list = listRef.current;
    if (list) {
      const rect = list.getBoundingClientRect();
      if (e.clientY < rect.top + 48) list.scrollBy(0, -12);
      else if (e.clientY > rect.bottom - 48) list.scrollBy(0, 12);
    }
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-tx-id]");
    const overId = row ? Number(row.dataset.txId) : null;
    if (overId === null || overId === dragId) return;
    const from = draft.findIndex((t) => t.id === dragId);
    const to = draft.findIndex((t) => t.id === overId);
    setDraft(moveItem(draft, from, to));
  }

  function onGripUp() {
    setDragId(null);
  }

  function nudge(index: number, delta: number) {
    if (draft) setDraft(moveItem(draft, index, index + delta));
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-40 flex justify-center sm:p-6 pointer-events-none">
        <div
          role="dialog"
          aria-label={`Fatura ${bill.name}`}
          className="card pointer-events-auto flex flex-col w-full h-full sm:max-w-2xl !rounded-none sm:!rounded-2xl overflow-hidden"
        >
          {/* Cabeçalho */}
          <div className="px-4 pt-4 pb-3 border-b border-line">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold truncate text-fg">{bill.name}</div>
                <div className="flex items-center gap-2 text-xs text-fg-muted">
                  {bill.cardLast4 && <span>•••• {bill.cardLast4}</span>}
                  {!loadError && <span className="font-numeric text-fg">{BRL(total)}</span>}
                </div>
              </div>
              <button onClick={onClose} aria-label="Fechar fatura" className="p-2 rounded-lg text-fg-soft hover:bg-fg/5">
                <X size={18} />
              </button>
            </div>

            {summary.count > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-fg-muted">
                  <span>
                    {summary.checkedCount} de {summary.count} conferidas
                  </span>
                  <span>
                    {summary.checkedCount === summary.count ? "tudo conferido" : `falta ${BRL(summary.pendingTotal)}`}
                  </span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-surface-raised overflow-hidden">
                  <div
                    className="h-full bg-accent-strong transition-all"
                    style={{ width: `${(summary.checkedCount / summary.count) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Barra de busca/filtros ou de reordenação */}
          <div className="px-4 py-3 border-b border-line space-y-2 bg-surface">
            {reordering ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs text-fg-soft">Arraste pela alça ou use as setas.</span>
                <button
                  onClick={() => setDraft(null)}
                  disabled={savingOrder}
                  className="px-2.5 py-1.5 rounded-lg text-xs border border-line bg-surface-raised text-fg-soft"
                >
                  Cancelar
                </button>
                <button
                  onClick={finishReorder}
                  disabled={savingOrder}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-strong"
                  style={{ color: "rgb(var(--on-accent))" }}
                >
                  {savingOrder ? "Salvando..." : "Concluir"}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bg border border-line">
                    <Search size={14} className="text-fg-muted flex-shrink-0" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar por nome ou valor"
                      className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                      aria-label="Buscar transação"
                    />
                    {query && (
                      <button onClick={() => setQuery("")} aria-label="Limpar busca" className="text-fg-muted">
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  {!locked && (
                    <button
                      onClick={() => {
                        setEditTransaction(null);
                        setShowForm(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-line bg-surface-raised text-fg-soft"
                    >
                      <Plus size={14} />
                      Adicionar
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
                  {KIND_CHIPS.map((c) => (
                    <Chip key={c.value} active={kind === c.value} onClick={() => setKind(c.value)}>
                      {c.label}
                    </Chip>
                  ))}
                  <Chip active={onlyUnchecked} onClick={() => setOnlyUnchecked((v) => !v)}>
                    Não conferidas
                  </Chip>
                  {!locked && (
                    <button
                      onClick={() => setDraft(transactions)}
                      disabled={filterActive || transactions.length < 2}
                      title={filterActive ? "Limpe os filtros para reordenar" : undefined}
                      className="ml-auto flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-line text-fg-soft disabled:opacity-40"
                    >
                      <ArrowUpDown size={12} />
                      Reordenar
                    </button>
                  )}
                </div>
                {!locked && filterActive && (
                  <div className="text-[11px] text-fg-muted">
                    Mostrando {visible.length} de {transactions.length}.{" "}
                    <button onClick={clearFilters} className="underline text-accent">
                      Limpar filtros
                    </button>{" "}
                    para reordenar.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Lista */}
          <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="p-6 text-center text-sm text-fg-muted">Carregando transações...</div>
            ) : loadError ? (
              <div className="p-6 text-center text-sm space-y-2">
                <p className="text-negative">{loadError}</p>
                <button onClick={fetchTransactions} className="underline text-accent">
                  Tentar de novo
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="p-6 text-center text-sm text-fg-muted space-y-2">
                <p>{transactions.length === 0 ? "Nenhuma transação cadastrada" : "Nenhuma transação encontrada"}</p>
                {filterActive && (
                  <button onClick={clearFilters} className="underline text-accent">
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-line">
                {visible.map((t, index) => {
                  const items = t.items || [];
                  const hasItems = items.length > 0;
                  const isOpen = expanded.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      data-tx-id={t.id}
                      className={`px-4 ${dragId === t.id ? "bg-fg/5" : ""}`}
                    >
                      <div className="flex items-center gap-3 py-2.5">
                        {reordering ? (
                          <button
                            onPointerDown={(e) => onGripDown(e, t.id)}
                            onPointerMove={onGripMove}
                            onPointerUp={onGripUp}
                            onPointerCancel={onGripUp}
                            aria-label="Arrastar para reordenar"
                            className="p-1 -ml-1 text-fg-muted cursor-grab active:cursor-grabbing"
                            style={{ touchAction: "none" }}
                          >
                            <GripVertical size={18} />
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleChecked(t)}
                            disabled={locked}
                            aria-label={t.checked ? "Desmarcar conferida" : "Marcar como conferida"}
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              t.checked ? "border-accent-strong bg-accent-strong" : "border-line"
                            }`}
                          >
                            {t.checked && <Check size={12} strokeWidth={3} color="rgb(var(--on-accent))" />}
                          </button>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate ${t.checked ? "text-fg-muted" : "text-fg"}`}>
                            {t.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
                            {t.date && <span>{formatDateBR(t.date)}</span>}
                            {t.recurring && (
                              <span className="flex items-center gap-0.5 text-accent">
                                <Repeat size={11} />
                                Recorrente
                              </span>
                            )}
                            {t.installment && <span>{t.installment}</span>}
                            {t.category && <span>• {categoryLabel(normalizeCategory(t.category))}</span>}
                            {hasItems && !reordering && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpanded((prev) => (prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]))
                                }
                                className="flex items-center gap-0.5 text-accent"
                              >
                                <Receipt size={11} />
                                {items.length} {items.length === 1 ? "item" : "itens"}
                                {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="text-sm font-bold font-numeric text-right text-fg flex-shrink-0">{BRL(t.amount)}</div>

                        {reordering ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => nudge(index, -1)}
                              disabled={index === 0}
                              aria-label="Mover para cima"
                              className="p-1.5 rounded bg-surface-raised text-fg-soft disabled:opacity-30"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              onClick={() => nudge(index, 1)}
                              disabled={index === visible.length - 1}
                              aria-label="Mover para baixo"
                              className="p-1.5 rounded bg-surface-raised text-fg-soft disabled:opacity-30"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                        ) : (
                          !locked && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditTransaction(t);
                                  setShowForm(true);
                                }}
                                aria-label="Editar transação"
                                className="p-1.5 rounded bg-surface-raised text-fg-soft"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => handleDelete(t)}
                                aria-label="Remover transação"
                                className="p-1.5 rounded bg-surface-raised text-negative"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )
                        )}
                      </div>

                      {/* Itens (produtos) da compra */}
                      {hasItems && isOpen && !reordering && (
                        <div className="pb-2 ml-9 pl-2 space-y-1 border-l-2 border-line">
                          {items.map((it, idx) => (
                            <div key={it.id ?? `${it.name}-${idx}`} className="flex items-center justify-between text-xs">
                              <span className="truncate text-fg-soft">
                                {it.quantity && it.quantity !== 1 ? `${fmtQty(it.quantity)}× ` : ""}
                                {it.name}
                              </span>
                              <span className="font-numeric flex-shrink-0 ml-2 text-fg-muted">{BRL(it.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {reordering && hasManualOrder && (
              <div className="p-4 text-center">
                <button onClick={resetOrder} disabled={savingOrder} className="text-xs underline text-fg-muted">
                  Voltar à ordem por data
                </button>
              </div>
            )}
          </div>

          {/* Rodapé */}
          {transactions.length > 0 && (
            <div className="px-4 py-3 flex items-center justify-between border-t border-line bg-surface-raised">
              <span className="text-xs font-medium uppercase tracking-wide text-fg-soft">
                {filterActive && !reordering ? `Filtrado (${visible.length})` : `Total (${transactions.length})`}
              </span>
              <span className="text-sm font-bold font-numeric text-fg">
                {filterActive && !reordering ? (
                  <>
                    {BRL(visibleTotal)} <span className="font-normal text-fg-muted">de {BRL(total)}</span>
                  </>
                ) : (
                  BRL(total)
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <CardTransactionForm
          billId={bill.id}
          transaction={editTransaction}
          onClose={() => {
            setShowForm(false);
            setEditTransaction(null);
          }}
          onSave={() => {
            setShowForm(false);
            setEditTransaction(null);
            fetchTransactions();
          }}
        />
      )}
    </ModalPortal>
  );
}
