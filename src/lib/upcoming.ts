// Contas a vencer — regra do bloco "Próximos dias" da tela Hoje, reaproveitada pelo assistente
// do WhatsApp e pelo aviso diário. Pura (sem DB) para ser testável.

export interface UpcomingItem {
  kind: "bill" | "future";
  id: number;
  name: string;
  amount: number | null;
  dueDate: string; // YYYY-MM-DD
  overdue: boolean;
}

interface UpcomingBill {
  id: number;
  name: string;
  amount: number;
  month: number;
  year: number;
  dueDay: number | null;
  isPaid: boolean | null;
}

interface UpcomingFuture {
  id: number;
  name: string;
  amount: number | null;
  reminderDate: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

// Pendentes com vencimento de hoje até hoje + `days`, com as vencidas do mês corrente no topo.
export function listUpcoming(bills: UpcomingBill[], futureBills: UpcomingFuture[], now: Date, days = 7): UpcomingItem[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const end = new Date(today);
  end.setDate(end.getDate() + days);
  const endStr = isoDate(end.getFullYear(), end.getMonth() + 1, end.getDate());

  const seen = new Set<number>();
  const candidates = bills.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return !b.isPaid && !!b.dueDay;
  });
  const calMonth = today.getMonth() + 1;
  const calYear = today.getFullYear();
  const upcoming: UpcomingItem[] = candidates
    .map((b) => {
      const dueDate = isoDate(b.year, b.month, b.dueDay as number);
      const overdue = dueDate < todayStr && b.month === calMonth && b.year === calYear;
      return { kind: "bill" as const, id: b.id, name: b.name, amount: b.amount, dueDate, overdue };
    })
    .filter((u) => u.overdue || (u.dueDate >= todayStr && u.dueDate <= endStr));

  for (const f of futureBills) {
    if (!f.reminderDate) continue;
    const d = f.reminderDate.slice(0, 10);
    if (d >= todayStr && d <= endStr) {
      upcoming.push({ kind: "future", id: f.id, name: f.name, amount: f.amount ?? null, dueDate: d, overdue: false });
    }
  }
  upcoming.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueDate.localeCompare(b.dueDate));
  return upcoming;
}
