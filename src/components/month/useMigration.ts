"use client";

import { useState } from "react";
import showToast from "@/components/ui/toast";
import {
  MONTHS,
  getNextMonthYear,
  incrementInstallment,
  incrementStrictInstallment,
} from "@/lib/month";
import type { Bill, CardTransaction } from "./types";

// Plano de migração — construído ao abrir o modal, permite escolher quais contas
// (e, dentro de faturas de cartão, quais parcelas/recorrentes) serão migradas para o próximo mês.
interface MigrateNormalItem {
  bill: Bill;
  nextInstallment: string | null;
}
interface MigrateParcela {
  id: number;
  name: string;
  amount: number;
  installment: string | null;
  // null para recorrentes (assinaturas), que se repetem sem parcela.
  nextInstallment: string | null;
  recurring: boolean;
  category: string | null;
  date: string | null;
}
interface MigrateCardItem {
  bill: Bill;
  parcelas: MigrateParcela[];
}
interface MigratePlan {
  normal: MigrateNormalItem[];
  cards: MigrateCardItem[];
  nextMonth: number;
  nextYear: number;
}

// Migração de contas para o próximo mês (antes no BillsManager; agora no menu "⋯" do Mês).
export function useMigration(bills: Bill[], month: number, year: number) {
  const [migrating, setMigrating] = useState(false);
  const [preparingMigration, setPreparingMigration] = useState(false);
  const [migratePlan, setMigratePlan] = useState<MigratePlan | null>(null);
  const [selectedBills, setSelectedBills] = useState<Set<number>>(new Set());
  const [selectedParcelas, setSelectedParcelas] = useState<Record<number, Set<number>>>({});
  const [expandedMigrateCards, setExpandedMigrateCards] = useState<Set<number>>(new Set());

  // Etapa 1 — monta o plano de migração (contas normais elegíveis + parcelas de
  // cartão que avançam) e abre o modal de seleção. Nada é gravado aqui.
  async function prepareMigration() {
    if (bills.length === 0) {
      showToast("Sem contas para migrar neste mês.");
      return;
    }
    setPreparingMigration(true);
    try {
      const { nextMonth, nextYear } = getNextMonthYear(month, year);

      const normal: MigrateNormalItem[] = [];
      for (const bill of bills.filter((b) => b.type !== "CARD")) {
        const nextInstallment = incrementInstallment(bill.installment);
        if (bill.installment && !nextInstallment) continue; // parcela encerrada
        normal.push({ bill, nextInstallment });
      }

      const cards: MigrateCardItem[] = [];
      for (const bill of bills.filter((b) => b.type === "CARD")) {
        const txRes = await fetch(`/api/bills/${bill.id}/transactions`);
        if (!txRes.ok) continue;
        const transactions: CardTransaction[] = await txRes.json();
        const parcelas = transactions
          .map((tx) => {
            const recurring = !!tx.recurring;
            const nextInstallment = recurring ? null : incrementStrictInstallment(tx.installment);
            if (!recurring && !nextInstallment) return null;
            return {
              id: tx.id,
              name: tx.name,
              amount: tx.amount,
              installment: tx.installment ?? null,
              nextInstallment,
              recurring,
              category: tx.category ?? null,
              // A data da compra é do mês atual; a recorrência do próximo mês não tem data ainda.
              date: recurring ? null : tx.date ?? null,
            };
          })
          .filter((p): p is MigrateParcela => p !== null);
        if (parcelas.length === 0) continue;
        cards.push({ bill, parcelas });
      }

      if (normal.length === 0 && cards.length === 0) {
        showToast("Nenhuma conta elegível para migração.");
        return;
      }

      setMigratePlan({ normal, cards, nextMonth, nextYear });
      setSelectedBills(new Set(normal.map((n) => n.bill.id)));
      const parcelaSel: Record<number, Set<number>> = {};
      for (const c of cards) parcelaSel[c.bill.id] = new Set(c.parcelas.map((p) => p.id));
      setSelectedParcelas(parcelaSel);
      setExpandedMigrateCards(new Set());
    } catch {
      showToast("Não foi possível preparar a migração.");
    } finally {
      setPreparingMigration(false);
    }
  }

  function toggleMigrateBill(id: number) {
    setSelectedBills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMigrateParcela(billId: number, txId: number) {
    setSelectedParcelas((prev) => {
      const set = new Set(prev[billId] ?? []);
      if (set.has(txId)) set.delete(txId);
      else set.add(txId);
      return { ...prev, [billId]: set };
    });
  }

  function toggleMigrateCardAll(card: MigrateCardItem) {
    setSelectedParcelas((prev) => {
      const cur = prev[card.bill.id] ?? new Set<number>();
      const allSelected = card.parcelas.every((p) => cur.has(p.id));
      const set = allSelected
        ? new Set<number>()
        : new Set(card.parcelas.map((p) => p.id));
      return { ...prev, [card.bill.id]: set };
    });
  }

  function toggleExpandMigrateCard(id: number) {
    setExpandedMigrateCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Etapa 2 — grava apenas o que foi selecionado no modal.
  async function executeMigration() {
    if (!migratePlan) return;
    const { normal, cards, nextMonth, nextYear } = migratePlan;

    const chosenNormal = normal.filter((n) => selectedBills.has(n.bill.id));
    const chosenCards = cards
      .map((c) => ({
        bill: c.bill,
        parcelas: c.parcelas.filter((p) =>
          (selectedParcelas[c.bill.id] ?? new Set<number>()).has(p.id),
        ),
      }))
      .filter((c) => c.parcelas.length > 0);

    if (chosenNormal.length === 0 && chosenCards.length === 0) {
      showToast("Selecione ao menos uma conta para migrar.");
      return;
    }

    setMigratePlan(null);
    setMigrating(true);
    try {
      const existingRes = await fetch(`/api/bills?month=${nextMonth}&year=${nextYear}`);
      if (!existingRes.ok) throw new Error("Erro ao buscar contas do próximo mês");
      const existingNextMonthBills: Bill[] = await existingRes.json();

      const existingByName = new Map(
        existingNextMonthBills.map((b) => [b.name.trim().toLowerCase(), b]),
      );

      const requests: Promise<Response>[] = [];

      // --- Contas normais selecionadas: avança a parcela (texto) e soma por nome ---
      const normalPayloads = chosenNormal.map(({ bill, nextInstallment }) => ({
        name: bill.name,
        amount: bill.amount,
        month: nextMonth,
        year: nextYear,
        installment: nextInstallment,
        isPaid: false,
        dueDay: bill.dueDay || null,
        category: bill.category || null,
        ownership: bill.ownership,
        notes: bill.notes || null,
        barCode: bill.barCode || null,
        qrCode: bill.qrCode || null,
        type: bill.type || "NORMAL",
        cardLast4: bill.cardLast4 || null,
        cardNickname: bill.cardNickname || null,
        date: bill.date || null,
      }));

      const mergedByName = new Map<string, (typeof normalPayloads)[number]>();
      for (const payload of normalPayloads) {
        const key = payload.name.trim().toLowerCase();
        const existing = mergedByName.get(key);
        if (existing) {
          mergedByName.set(key, { ...existing, amount: existing.amount + payload.amount });
        } else {
          mergedByName.set(key, payload);
        }
      }

      for (const payload of Array.from(mergedByName.values())) {
        const existing = existingByName.get(payload.name.trim().toLowerCase());
        if (existing) {
          requests.push(fetch(`/api/bills/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: payload.amount }),
          }));
        } else {
          requests.push(fetch("/api/bills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }));
        }
      }

      // --- Faturas de cartão: só as parcelas/recorrentes selecionadas viram linhas reais ---
      // Ex.: "1/10" nesta fatura vira "2/10" na próxima, mesmo valor, até "10/10".
      // Recorrentes (assinaturas) são repetidas com o mesmo valor.
      let migratedCards = 0;
      for (const { bill, parcelas } of chosenCards) {
        const carried = parcelas.map((p) => ({
          name: p.name,
          amount: p.amount,
          installment: p.nextInstallment,
          recurring: p.recurring,
          category: p.category,
          date: p.date,
        }));

        const existing = existingByName.get(bill.name.trim().toLowerCase());
        if (existing) {
          // Idempotência: não duplicar parcelas/recorrentes já presentes na fatura do próximo mês.
          const existingTxRes = await fetch(`/api/bills/${existing.id}/transactions`);
          const existingTx: CardTransaction[] = existingTxRes.ok ? await existingTxRes.json() : [];
          const txKey = (t: { name: string; installment?: string | null; recurring?: boolean }) =>
            `${t.name.trim().toLowerCase()}|${t.recurring ? "recorrente" : t.installment ?? ""}`;
          const seen = new Set(existingTx.map(txKey));
          const toAdd = carried.filter((t) => !seen.has(txKey(t)));
          for (const parcela of toAdd) {
            requests.push(fetch(`/api/bills/${existing.id}/transactions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parcela),
            }));
          }
          if (toAdd.length > 0) migratedCards += 1;
        } else {
          requests.push(fetch("/api/bills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: bill.name,
              amount: carried.reduce((sum, t) => sum + t.amount, 0),
              month: nextMonth,
              year: nextYear,
              installment: null,
              isPaid: false,
              dueDay: bill.dueDay || null,
              category: bill.category || null,
              ownership: bill.ownership,
              notes: bill.notes || null,
              barCode: bill.barCode || null,
              qrCode: bill.qrCode || null,
              type: "CARD" as const,
              cardLast4: bill.cardLast4 || null,
              cardNickname: bill.cardNickname || null,
              transactions: carried,
            }),
          }));
          migratedCards += 1;
        }
      }

      if (requests.length === 0) {
        showToast("Nenhuma conta elegível para migração.");
        return;
      }

      const responses = await Promise.all(requests);
      if (responses.some((res) => !res.ok)) {
        throw new Error("Erro ao migrar contas");
      }

      const totalMigrated = mergedByName.size + migratedCards;
      showToast(
        `${totalMigrated} conta(s) migrada(s) para ${MONTHS[nextMonth - 1]}/${nextYear}.`,
      );
    } catch {
      showToast("Não foi possível migrar as contas. Tente novamente.");
    } finally {
      setMigrating(false);
    }
  }

  return {
    migrating,
    preparingMigration,
    migratePlan,
    setMigratePlan,
    selectedBills,
    selectedParcelas,
    expandedMigrateCards,
    prepareMigration,
    toggleMigrateBill,
    toggleMigrateParcela,
    toggleMigrateCardAll,
    toggleExpandMigrateCard,
    executeMigration,
  };
}

export type Migration = ReturnType<typeof useMigration>;
