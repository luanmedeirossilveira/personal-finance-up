"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BillForm from "@/components/bills/BillForm";
import CategoryBudgets from "@/components/bills/CategoryBudgets";
import MealCardsManager from "@/components/meal-cards/MealCardsManager";
import Tabs from "@/components/ui/Tabs";
import showToast from "@/components/ui/toast";
import { summarizeMonth } from "@/lib/month";
import BillsTab from "./BillsTab";
import CloseMonth from "./CloseMonth";
import SalariesManager from "@/components/salaries/SalariesManager";
import BankInbox from "./BankInbox";
import CardPlans from "./CardPlans";
import MigrateModal from "./MigrateModal";
import MonthHeader from "./MonthHeader";
import { useMigration } from "./useMigration";
import { useMonthData } from "./useMonthData";
import type { Bill, BillSort, OwnershipFilter } from "./types";

type MonthTab = "contas" | "categorias" | "entradas";

const TABS: MonthTab[] = ["contas", "categorias", "entradas"];

// Tela Mês (ex-Contas): "o mês fecha?". Três abas no lugar da página única.
export default function MonthView({ workingPeriod }: Readonly<{ workingPeriod?: { month: number; year: number } }>) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const data = useMonthData(workingPeriod);
  const { bills, salaries, month, year, closing } = data;
  const closed = closing !== null;
  // Extrato do cartão alimentação mudou → Categorias recarrega.
  const [spendingKey, setSpendingKey] = useState(0);
  // Saldo dos cartões alimentação do mês (recarrega quando o extrato muda).
  const [meal, setMeal] = useState<{ limit: number; spent: number; count: number } | null>(null);
  useEffect(() => {
    fetch(`/api/meal-cards?month=${month}&year=${year}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((cards: { limitAmount: number; spent: number }[]) =>
        setMeal(
          Array.isArray(cards) && cards.length > 0
            ? {
                limit: cards.reduce((s, c) => s + c.limitAmount, 0),
                spent: cards.reduce((s, c) => s + (c.spent ?? 0), 0),
                count: cards.length,
              }
            : null,
        ),
      )
      .catch(() => setMeal(null));
  }, [month, year, data.version, spendingKey]);
  const migration = useMigration(bills, month, year);

  const initialTab = searchParams.get("tab") as MonthTab | null;
  const [tab, setTab] = useState<MonthTab>(initialTab && TABS.includes(initialTab) ? initialTab : "contas");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [sortBy, setSortBy] = useState<BillSort>("date");
  const [formBill, setFormBill] = useState<Bill | null | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  // Markdown do mês para colar no Claude; sem acesso à área de transferência, baixa o arquivo.
  async function exportForAI() {
    setExporting(true);
    try {
      const res = await fetch(`/api/month-export?month=${month}&year=${year}`);
      if (!res.ok) throw new Error();
      const text = await res.text();
      try {
        await navigator.clipboard.writeText(text);
        showToast("Dados do mês copiados — cole no Claude.");
      } catch {
        const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `mes-${year}-${String(month).padStart(2, "0")}.md`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Arquivo do mês baixado.");
      }
    } catch {
      showToast("Não foi possível gerar os dados do mês.");
    } finally {
      setExporting(false);
    }
  }

  function changeTab(next: MonthTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/mes?${params.toString()}`, { scroll: false });
  }

  // Aportes (categoria investimentos) saem de Saídas e ganham linha própria.
  const scoped = ownershipFilter === "all" ? bills : bills.filter((b) => b.ownership === ownershipFilter);
  const { invested, outflow, income, pending: pendingTotal } = summarizeMonth(scoped, salaries);

  const pendingCount = bills.filter((b) => !b.isPaid).length;
  // Saldo atual só faz sentido no mês em andamento (o do período de trabalho ou o do calendário).
  const now = new Date();
  const isLive =
    !closed &&
    ((workingPeriod && month === workingPeriod.month && year === workingPeriod.year) ||
      (month === now.getMonth() + 1 && year === now.getFullYear()));

  return (
    <div className="space-y-5">
      <MigrateModal migration={migration} />

      <MonthHeader
        month={month}
        year={year}
        onPrev={data.prevMonth}
        onNext={data.nextMonth}
        onNewBill={closed ? undefined : () => setFormBill(null)}
        ownershipFilter={ownershipFilter}
        onOwnershipFilter={setOwnershipFilter}
        sortBy={sortBy}
        onSort={setSortBy}
        onMigrate={migration.prepareMigration}
        migrateLabel={
          migration.migrating ? "Migrando..." : migration.preparingMigration ? "Preparando..." : "Migrar para o próximo mês"
        }
        migrateDisabled={migration.migrating || migration.preparingMigration || bills.length === 0}
        onExport={exportForAI}
        exportLabel={exporting ? "Gerando..." : "Copiar para IA"}
        closed={closed}
        income={income}
        outflow={outflow}
        invested={invested}
        pending={pendingTotal}
        bank={isLive ? data.bank : null}
        meal={meal}
      />

      <Tabs
        tabs={[
          { value: "contas", label: "Contas", count: pendingCount },
          { value: "categorias", label: "Categorias" },
          { value: "entradas", label: "Entradas" },
        ]}
        active={tab}
        onChange={changeTab}
      />

      <CloseMonth data={data} />

      {tab === "contas" && (
        <>
          {/* Primeiro card: o que o banco trouxe e ainda precisa de decisão */}
          <BankInbox data={data} locked={closed} />
          <BillsTab
            data={data}
            ownershipFilter={ownershipFilter}
            sortBy={sortBy}
            locked={closed}
            onEdit={(b) => setFormBill(b)}
            onNew={() => setFormBill(null)}
          />
          {/* Cartões alimentação junto dos gastos do mês */}
          <MealCardsManager
            month={month}
            year={year}
            readOnly={closed}
            refreshKey={data.version}
            onSpendingChange={() => setSpendingKey((k) => k + 1)}
          />
        </>
      )}

      {tab === "categorias" && (
        <>
          <CardPlans month={month} year={year} refreshKey={data.version} />
          <CategoryBudgets month={month} year={year} refreshKey={`${data.version}-${spendingKey}`} defaultExpanded />
        </>
      )}

      {tab === "entradas" && (
        <SalariesManager key={`${month}-${year}-${data.version}`} month={month} year={year} onSave={data.fetchData} />
      )}

      {formBill !== undefined && (
        <BillForm
          bill={formBill}
          month={month}
          year={year}
          onClose={() => setFormBill(undefined)}
          onSave={() => {
            setFormBill(undefined);
            data.fetchData();
          }}
        />
      )}
    </div>
  );
}
