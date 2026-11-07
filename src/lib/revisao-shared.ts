// Regras de calendário da Revisão sem dependências de servidor (podem ser importadas no cliente e em testes).
import { getISOWeek, getISOWeekYear, subDays } from "date-fns";
import { todayISO } from "./month";

export const SNOOZE_HOURS = 2;

export interface ReviewedWeek {
  weekNumber: number;
  isoYear: number;
  start: string; // segunda, YYYY-MM-DD
  end: string; // domingo
}

// Qualquer dia da semana ISO N revisa a semana N-1.
export function reviewedWeek(now = new Date()): ReviewedWeek {
  const ref = subDays(now, 7);
  const dow = (ref.getDay() + 6) % 7; // 0 = segunda
  const monday = subDays(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()), dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekNumber: getISOWeek(ref),
    isoYear: getISOWeekYear(ref),
    start: todayISO(monday),
    end: todayISO(sunday),
  };
}

// Mês fechado pelo fechamento mensal: o mês anterior ao calendário atual.
export function reviewedMonth(now = new Date()) {
  const m = now.getMonth() + 1;
  return m === 1 ? { month: 12, year: now.getFullYear() - 1 } : { month: m - 1, year: now.getFullYear() };
}
