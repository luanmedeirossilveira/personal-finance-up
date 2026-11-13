"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import ModalPortal from "@/components/ui/ModalPortal";
import { BRL, MONTHS } from "@/lib/month";
import type { Migration } from "./useMigration";

export default function MigrateModal({ migration }: Readonly<{ migration: Migration }>) {
  const {
    migratePlan,
    setMigratePlan,
    selectedBills,
    selectedParcelas,
    expandedMigrateCards,
    toggleMigrateBill,
    toggleMigrateParcela,
    toggleMigrateCardAll,
    toggleExpandMigrateCard,
    executeMigration,
  } = migration;

  if (!migratePlan) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={() => setMigratePlan(null)}
      />
      <div className="fixed inset-0 z-50 flex justify-center p-4 items-end sm:items-center">
        <div
          className="card rounded-t-2xl sm:rounded-2xl p-6 space-y-4 w-full sm:max-w-md max-h-[90vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <h4 className="text-sm font-bold" style={{ color: "rgb(var(--text))" }}>
              Migrar para {MONTHS[migratePlan.nextMonth - 1]}/{migratePlan.nextYear}
            </h4>
            <p className="text-[11px] mt-1" style={{ color: "rgb(var(--text-muted))" }}>
              Escolha o que levar para o próximo mês. Parcelas avançam +1; recorrentes se repetem.
            </p>
          </div>

          {/* Contas normais */}
          {migratePlan.normal.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--text-soft))" }}>
                Contas
              </span>
              {migratePlan.normal.map(({ bill, nextInstallment }) => (
                <label
                  key={bill.id}
                  className="flex items-center gap-2 p-2 rounded bg-[rgb(var(--bg))] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedBills.has(bill.id)}
                    onChange={() => toggleMigrateBill(bill.id)}
                    className="accent-[rgb(var(--accent-strong))]"
                  />
                  <span className="flex-1 min-w-0 text-sm truncate" style={{ color: "rgb(var(--text))" }}>
                    {bill.name}
                    {nextInstallment && (
                      <span className="ml-1 text-[11px]" style={{ color: "rgb(var(--accent))" }}>
                        ({nextInstallment})
                      </span>
                    )}
                  </span>
                  <span className="text-xs" style={{ color: "rgb(var(--text-soft))" }}>{BRL(bill.amount)}</span>
                </label>
              ))}
            </div>
          )}

          {/* Faturas de cartão com parcelas e recorrentes */}
          {migratePlan.cards.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--text-soft))" }}>
                Cartões — parcelas e recorrentes
              </span>
              {migratePlan.cards.map((card) => {
                const sel = selectedParcelas[card.bill.id] ?? new Set<number>();
                const allSelected = card.parcelas.every((p) => sel.has(p.id));
                const recurringTotal = card.parcelas
                  .filter((p) => p.recurring && sel.has(p.id))
                  .reduce((sum, p) => sum + p.amount, 0);
                const expanded = expandedMigrateCards.has(card.bill.id);
                return (
                  <div key={card.bill.id} className="rounded bg-[rgb(var(--bg))]">
                    <div className="flex items-center gap-2 p-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => toggleMigrateCardAll(card)}
                        className="accent-[rgb(var(--accent-strong))]"
                      />
                      <button
                        type="button"
                        onClick={() => toggleExpandMigrateCard(card.bill.id)}
                        className="flex-1 min-w-0 flex items-center gap-1 text-left"
                      >
                        <span className="flex-1 min-w-0 text-sm truncate" style={{ color: "rgb(var(--text))" }}>
                          {card.bill.name}
                        </span>
                        <span className="text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
                          {sel.size}/{card.parcelas.length}
                        </span>
                        {expanded ? (
                          <ChevronUp size={14} style={{ color: "rgb(var(--text-soft))" }} />
                        ) : (
                          <ChevronDown size={14} style={{ color: "rgb(var(--text-soft))" }} />
                        )}
                      </button>
                    </div>
                    {recurringTotal > 0 && (
                      <div className="px-2 pb-1 pl-8 text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
                        Assinaturas: {BRL(recurringTotal)}/mês
                      </div>
                    )}
                    {expanded && (
                      <div className="px-2 pb-2 space-y-1">
                        {card.parcelas.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 pl-6 py-1 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={sel.has(p.id)}
                              onChange={() => toggleMigrateParcela(card.bill.id, p.id)}
                              className="accent-[rgb(var(--accent-strong))]"
                            />
                            <span className="flex-1 min-w-0 text-xs truncate" style={{ color: "rgb(var(--text))" }}>
                              {p.name}
                              <span className="ml-1" style={{ color: "rgb(var(--accent))" }}>
                                {p.recurring ? "Recorrente" : `${p.installment ?? "?"} → ${p.nextInstallment}`}
                              </span>
                            </span>
                            <span className="text-xs" style={{ color: "rgb(var(--text-soft))" }}>{BRL(p.amount)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setMigratePlan(null)}
              className="px-3 py-2 rounded text-sm"
              style={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text-soft))" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={executeMigration}
              className="px-3 py-2 rounded text-sm font-semibold"
              style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
            >
              Migrar (
              {migratePlan.normal.filter((n) => selectedBills.has(n.bill.id)).length +
                migratePlan.cards.filter(
                  (c) => (selectedParcelas[c.bill.id]?.size ?? 0) > 0,
                ).length}
              )
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
