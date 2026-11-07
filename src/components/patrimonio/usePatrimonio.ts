"use client";

import { useCallback, useEffect, useState } from "react";
import type { Account, Investment, NetWorthSnapshot, PluggyItem } from "@/lib/db/schema";

export interface PatrimonioData {
  accounts: Account[];
  investments: Investment[];
  items: PluggyItem[];
  netWorth: { accountsTotal: number; investmentsTotal: number; debtsTotal: number; netWorth: number };
  history: NetWorthSnapshot[];
  pluggyConfigured: boolean;
}

export function usePatrimonio() {
  const [data, setData] = useState<PatrimonioData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/accounts");
    if (!res.ok) {
      setError("Não foi possível carregar contas e investimentos. As migrations 0017–0019 já foram aplicadas?");
      return;
    }
    setError(null);
    setData(await res.json());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, reload };
}
