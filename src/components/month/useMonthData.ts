"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import showConfirm from "@/components/ui/confirm";
import { getDefaultPeriod, todayISO } from "@/lib/month";
import type { Closing } from "@/lib/month-closing";
import type { Bill, FutureBill, Salary } from "./types";

// Estado e ações do mês selecionado: contas, entradas e previstos (Futuras).
export function useMonthData(workingPeriod?: { month: number; year: number }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const defaultPeriod = workingPeriod ?? getDefaultPeriod(new Date());
  const [month, setMonth] = useState(
    Number.parseInt(searchParams.get("month") || String(defaultPeriod.month), 10),
  );
  const [year, setYear] = useState(
    Number.parseInt(searchParams.get("year") || String(defaultPeriod.year), 10),
  );

  const [bills, setBills] = useState<Bill[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [futureBills, setFutureBills] = useState<FutureBill[]>([]);
  const [closing, setClosing] = useState<Closing | null>(null);
  // Saldo de hoje nas contas do banco (corrente/poupança visíveis; cartões e investimentos fora).
  const [bank, setBank] = useState<{ balance: number; syncedAt: string | null; label: string } | null>(null);
  const [loading, setLoading] = useState(true);
  // Muda a cada recarga: componentes filhos (Categorias, cartões alimentação) recarregam junto.
  const [version, setVersion] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [billsRes, salariesRes, futureRes, closingRes] = await Promise.all([
      fetch(`/api/bills?month=${month}&year=${year}`),
      fetch(`/api/salaries?month=${month}&year=${year}`),
      fetch(`/api/future-bills`),
      fetch(`/api/month-closings?month=${month}&year=${year}`),
    ]);
    const [b, s, f, c] = await Promise.all([
      billsRes.json(),
      salariesRes.json(),
      futureRes.ok ? futureRes.json() : [],
      closingRes.ok ? closingRes.json() : { closing: null },
    ]);
    setBills(b);
    setSalaries(s);
    setFutureBills(f);
    setClosing(c.closing ?? null);
    setVersion((v) => v + 1);
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list: { name: string; type: string; archived: boolean; balance: number; lastSyncAt: string | null }[] = (
          d?.accounts ?? []
        ).filter((a: { type: string; archived: boolean }) => (a.type === "checking" || a.type === "savings") && !a.archived);
        if (list.length === 0) return setBank(null);
        const synced = list.map((a) => a.lastSyncAt).filter((x): x is string => Boolean(x)).sort().pop() ?? null;
        setBank({
          balance: list.reduce((s, a) => s + a.balance, 0),
          syncedAt: synced,
          label: list.length === 1 ? list[0].name : `${list.length} contas`,
        });
      })
      .catch(() => setBank(null));
  }, []);

  function navigate(newMonth: number, newYear: number) {
    setMonth(newMonth);
    setYear(newYear);
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", String(newMonth));
    params.set("year", String(newYear));
    router.push(`/mes?${params.toString()}`, { scroll: false });
  }

  function prevMonth() {
    if (month === 1) navigate(12, year - 1);
    else navigate(month - 1, year);
  }

  function nextMonth() {
    if (month === 12) navigate(1, year + 1);
    else navigate(month + 1, year);
  }

  async function closeMonth() {
    const res = await fetch("/api/month-closings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false as const, error: (body.error as string) ?? "Não foi possível fechar o mês." };
    setClosing(body.closing);
    return { ok: true as const, working: body.working as { month: number; year: number } | null };
  }

  async function reopenMonth() {
    await fetch(`/api/month-closings?month=${month}&year=${year}`, { method: "DELETE" });
    setClosing(null);
    setVersion((v) => v + 1);
  }

  async function togglePaid(bill: Bill) {
    const nextPaid = !bill.isPaid;
    const patch: { isPaid: boolean; date?: string } = { isPaid: nextPaid };
    // Ao marcar como paga, registra a data de pagamento (se ainda não houver uma definida).
    if (nextPaid && !bill.date) patch.date = todayISO();
    await fetch(`/api/bills/${bill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBills((prev) => prev.map((b) => (b.id === bill.id ? { ...b, ...patch } : b)));
  }

  async function deleteBill(id: number) {
    const ok = await showConfirm("Remover esta conta?");
    if (!ok) return;
    await fetch(`/api/bills/${id}`, { method: "DELETE" });
    setBills((prev) => prev.filter((b) => b.id !== id));
  }

  function setBillAmount(id: number, amount: number) {
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, amount } : b)));
  }

  // Previsto do mês: Futuras cujo lembrete cai neste mês (sem data, ficam no mês corrente).
  const now = new Date();
  const monthFuture = futureBills.filter((f) => {
    if (!f.reminderDate) return month === now.getMonth() + 1 && year === now.getFullYear();
    const [y, m] = f.reminderDate.split("-").map(Number);
    return y === year && m === month;
  });

  // Converte uma Futura em conta real no mês exibido e remove o lembrete.
  async function acceptFuture(f: FutureBill) {
    const day = f.reminderDate ? Number(f.reminderDate.split("-")[2]) : null;
    const res = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.name,
        amount: f.amount ?? 0,
        month,
        year,
        dueDay: day,
        isPaid: false,
        notes: f.notes ?? null,
      }),
    });
    if (!res.ok) return false;
    await fetch(`/api/future-bills?id=${f.id}`, { method: "DELETE" });
    await fetchData();
    return true;
  }

  return {
    month,
    year,
    bills,
    salaries,
    monthFuture,
    loading,
    closing,
    bank,
    version,
    closeMonth,
    reopenMonth,
    fetchData,
    navigate,
    prevMonth,
    nextMonth,
    togglePaid,
    deleteBill,
    setBillAmount,
    acceptFuture,
  };
}

export type MonthData = ReturnType<typeof useMonthData>;
