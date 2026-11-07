import { describe, it, expect } from 'vitest';
import { reviewedMonth, reviewedWeek } from '../src/lib/revisao-shared';

describe('revisão: semana revisada', () => {
  it('qualquer dia da semana revisa a semana ISO anterior', () => {
    // segunda 09/11/2026 (semana 46) e domingo 15/11/2026 → semana 45
    expect(reviewedWeek(new Date(2026, 10, 9, 0, 1))).toMatchObject({ weekNumber: 45, isoYear: 2026, start: '2026-11-02', end: '2026-11-08' });
    expect(reviewedWeek(new Date(2026, 10, 15, 23, 0)).weekNumber).toBe(45);
  });

  it('usa o ano ISO na virada de ano', () => {
    // 04/01/2027 (semana 1 de 2027) revisa a semana que começou em 28/12/2026 → semana 53 de 2026
    expect(reviewedWeek(new Date(2027, 0, 4))).toMatchObject({ weekNumber: 53, isoYear: 2026, start: '2026-12-28' });
    // 11/01/2027 revisa a semana 1 de 2027, que começou em 2026
    expect(reviewedWeek(new Date(2027, 0, 11))).toMatchObject({ weekNumber: 1, isoYear: 2027, start: '2027-01-04' });
  });

  it('fechamento mensal é o mês anterior, cruzando o ano', () => {
    expect(reviewedMonth(new Date(2026, 10, 7))).toEqual({ month: 10, year: 2026 });
    expect(reviewedMonth(new Date(2027, 0, 2))).toEqual({ month: 12, year: 2026 });
  });
});
