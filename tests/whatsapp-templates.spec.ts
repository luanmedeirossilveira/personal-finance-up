import { describe, it, expect } from 'vitest';
import { summarizeMonth } from '../src/lib/month';
import { listUpcoming, type UpcomingItem } from '../src/lib/upcoming';
import { isPendingExpired, parseExpensePayload, pendingExpiresAt } from '../src/lib/whatsapp/pending';
import {
  categoryOptionsReply,
  categorySpendingReply,
  confirmExpenseReply,
  dueAlertMessage,
  monthSummaryReply,
  recentReply,
  registeredReply,
  relativeDate,
  topCategoriesReply,
  upcomingReply,
} from '../src/lib/whatsapp/templates';

// domingo, 22/11/2026
const TODAY = new Date(2026, 10, 22, 14, 30);

const item = (over: Partial<UpcomingItem> = {}): UpcomingItem => ({
  kind: 'bill', id: 1, name: 'Luz', amount: 182.4, dueDate: '2026-11-22', overdue: false, ...over,
});

describe('whatsapp: datas relativas', () => {
  it('usa hoje, amanhã, ontem e dia da semana', () => {
    expect(relativeDate('2026-11-22', TODAY)).toBe('hoje');
    expect(relativeDate('2026-11-23', TODAY)).toBe('amanhã');
    expect(relativeDate('2026-11-21', TODAY)).toBe('ontem');
    expect(relativeDate('2026-11-24', TODAY)).toBe('ter 24/11');
    expect(relativeDate('2026-12-01 10:00:00', TODAY)).toBe('ter 01/12');
  });
});

describe('whatsapp: templates', () => {
  it('resumo do mês com saldo previsto igual ao do site', () => {
    const s = summarizeMonth(
      [
        { amount: 1000, category: 'moradia', isPaid: true },
        { amount: 300, category: 'investimentos', isPaid: false },
        { amount: 200, category: 'lazer', isPaid: false },
      ],
      [{ amount: 5000 }],
    );
    expect(s).toEqual({ income: 5000, outflow: 1200, invested: 300, pending: 500, pendingCount: 2, balance: 3500 });
    expect(monthSummaryReply('Dezembro/2026', s)).toBe(
      ['*Dezembro/2026*', 'Entradas: R$ 5.000,00', 'Saídas: R$ 1.200,00', 'Investido: R$ 300,00', 'A pagar: R$ 500,00 (2 contas)', 'Saldo previsto: *R$ 3.500,00*'].join('\n'),
    );
    expect(monthSummaryReply('Outubro/2026', summarizeMonth([], []), true)).toContain('(fechado)');
  });

  it('gasto de uma categoria com limite', () => {
    expect(categorySpendingReply('Novembro/2026', 'alimentação', 830, 1000)).toBe(
      ['*Alimentação* em Novembro/2026: *R$ 830,00*', 'Limite: R$ 1.000,00 (83% do limite)', 'Sobram R$ 170,00'].join('\n'),
    );
    expect(categorySpendingReply('Novembro/2026', 'lazer', 120)).toBe('*Lazer* em Novembro/2026: *R$ 120,00*');
    expect(categorySpendingReply('Novembro/2026', 'lazer', 150, 100)).toContain('⚠️ R$ 50,00 acima do limite');
  });

  it('top 5 categorias com total', () => {
    const reply = topCategoriesReply(
      'Novembro/2026',
      { moradia: 2000, alimentação: 900, lazer: 100, saude: 50, compras: 40, outros: 10, beleza: 0 },
      { alimentação: 1000 },
    );
    const lines = reply.split('\n');
    expect(lines[0]).toBe('*Gastos de Novembro/2026*');
    expect(lines[1]).toBe('1. Moradia: R$ 2.000,00');
    expect(lines[2]).toBe('2. Alimentação: R$ 900,00 (90% do limite)');
    expect(lines).toHaveLength(7);
    expect(lines[6]).toBe('Total: *R$ 3.100,00*');
    expect(topCategoriesReply('Novembro/2026', {}, {})).toBe('Nenhum gasto lançado em Novembro/2026 ainda.');
  });

  it('contas a vencer com vencidas marcadas e no máximo 8 linhas de itens', () => {
    const reply = upcomingReply([item({ overdue: true, dueDate: '2026-11-20', name: 'Água' }), item(), item({ kind: 'future', name: 'IPVA', amount: null, dueDate: '2026-11-23' })], 7, TODAY);
    expect(reply).toBe(
      ['*Vencem nos próximos 7 dias:*', '• Água — R$ 182,40 — ⚠️ vencida sex 20/11', '• Luz — R$ 182,40 — hoje', '• IPVA — valor a definir — amanhã'].join('\n'),
    );
    expect(upcomingReply([], 7, TODAY)).toBe('Nada vencendo nos próximos 7 dias ✅');
    const many = Array.from({ length: 12 }, (_, i) => item({ id: i }));
    expect(upcomingReply(many, 30, TODAY).split('\n')).toHaveLength(10);
  });

  it('últimos lançamentos', () => {
    expect(recentReply([{ name: 'Posto', amount: 45, date: '2026-11-22', category: 'transporte', origin: null }, { name: 'Pão', amount: 12.5, date: '2026-11-21', category: 'mercado', origin: 'VR' }], TODAY)).toBe(
      ['*Últimos 2 lançamentos:*', '• hoje Posto — R$ 45,00 (Transporte)', '• ontem Pão — R$ 12,50 (Alimentação · VR)'].join('\n'),
    );
    expect(recentReply([], TODAY)).toBe('Nenhum lançamento ainda.');
  });

  it('confirmação de gasto, opções de categoria e registro', () => {
    expect(confirmExpenseReply({ valor: 45, descricao: 'posto', categoria: 'transporte', data: '2026-11-22' }, TODAY)).toBe(
      'Registrar *R$ 45,00* em *Transporte* — "posto" — hoje?\nResponda *sim* ou *não*.',
    );
    expect(categoryOptionsReply(['saude', 'lazer'])).toBe('Qual categoria?\n1. Saúde\n2. Lazer\nResponda com o número.');
    expect(registeredReply(1234.5)).toBe('✅ Registrado. Saldo do mês: R$ 1.234,50');
  });

  it('aviso proativo agrupa as contas numa mensagem', () => {
    expect(dueAlertMessage([item(), item({ name: 'Internet', amount: 99.9, dueDate: '2026-11-23' })], TODAY)).toBe(
      '🔔 Vencem em breve:\n• Luz — R$ 182,40 — hoje\n• Internet — R$ 99,90 — amanhã',
    );
  });
});

describe('contas a vencer (regra do Hoje)', () => {
  const bill = (over: Partial<Parameters<typeof listUpcoming>[0][number]> = {}) => ({
    id: 1, name: 'Luz', amount: 100, month: 11, year: 2026, dueDay: 25, isPaid: false, ...over,
  });

  it('lista pendentes da janela com vencidas do mês corrente no topo', () => {
    const list = listUpcoming(
      [
        bill({ id: 1, dueDay: 25 }),
        bill({ id: 2, dueDay: 10, name: 'Atrasada' }),
        bill({ id: 3, dueDay: 23, isPaid: true }),
        bill({ id: 4, dueDay: 30 }),
        bill({ id: 5, month: 10, dueDay: 30, name: 'Outubro' }),
        bill({ id: 6, dueDay: null }),
        bill({ id: 1, dueDay: 25 }),
      ],
      [{ id: 9, name: 'IPVA', amount: null, reminderDate: '2026-11-24' }],
      TODAY,
      7,
    );
    expect(list.map((u) => `${u.name}:${u.dueDate}:${u.overdue}`)).toEqual([
      'Atrasada:2026-11-10:true',
      'IPVA:2026-11-24:false',
      'Luz:2026-11-25:false',
    ]);
  });

  it('janela de 1 dia pega hoje e amanhã, cruzando o mês', () => {
    const lastDay = new Date(2026, 10, 30, 8);
    const list = listUpcoming([bill({ dueDay: 30 }), bill({ id: 2, month: 12, dueDay: 1 }), bill({ id: 3, month: 12, dueDay: 2 })], [], lastDay, 1);
    expect(list.map((u) => u.dueDate)).toEqual(['2026-11-30', '2026-12-01']);
  });
});

describe('whatsapp: pendência de confirmação', () => {
  it('expira em 10 minutos', () => {
    const now = new Date('2026-11-22T17:00:00Z');
    const expiresAt = pendingExpiresAt(now);
    expect(expiresAt).toBe('2026-11-22T17:10:00.000Z');
    expect(isPendingExpired(expiresAt, new Date('2026-11-22T17:09:59Z'))).toBe(false);
    expect(isPendingExpired(expiresAt, new Date('2026-11-22T17:10:00Z'))).toBe(true);
  });

  it('ignora payload corrompido', () => {
    expect(parseExpensePayload('{"valor":45,"descricao":"posto","categoria":"transporte","data":"2026-11-22"}')).toMatchObject({ valor: 45 });
    expect(parseExpensePayload('{"valor":"45"}')).toBeNull();
    expect(parseExpensePayload('não é json')).toBeNull();
  });
});
