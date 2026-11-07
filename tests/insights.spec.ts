import { describe, it, expect, vi } from 'vitest';
import { findBillMatch } from '../src/lib/reconcile';
import { committedInstallments, detectNewSubscriptions } from '../src/lib/insights/facts';
import { numbersAreGrounded } from '../src/lib/insights/gemini';

// Os módulos importam o cliente do banco; os testes só usam as funções puras (vi.mock é içado).
vi.mock('@/lib/db', () => ({ db: {}, schema: {} }));

const bill = (over: Record<string, unknown>) =>
  ({ id: 1, amount: 100, month: 11, year: 2026, dueDay: 10, isPaid: false, ...over }) as never;

describe('conciliação', () => {
  it('casa valor ±1% e vencimento ±5 dias', () => {
    const bills = [bill({ id: 1, amount: 100.5 }), bill({ id: 2, amount: 300 })];
    expect(findBillMatch({ amount: -100, date: '2026-11-12' }, bills, new Set())?.id).toBe(1);
  });
  it('não casa fora da tolerância, entradas ou contas já pagas', () => {
    expect(findBillMatch({ amount: -100, date: '2026-11-20' }, [bill({})], new Set())).toBeNull();
    expect(findBillMatch({ amount: -95, date: '2026-11-10' }, [bill({})], new Set())).toBeNull();
    expect(findBillMatch({ amount: 100, date: '2026-11-10' }, [bill({})], new Set())).toBeNull();
    expect(findBillMatch({ amount: -100, date: '2026-11-10' }, [bill({ isPaid: true })], new Set())).toBeNull();
  });
});

describe('fatos dos insights', () => {
  it('soma parcelas comprometidas nos próximos meses', () => {
    const r = committedInstallments([
      { amount: 100, installment: '3/5' },
      { amount: 50, installment: '1/2' },
      { amount: 999, installment: 'SEMPRE' },
    ]);
    expect(r.perMonth.slice(0, 3)).toEqual([150, 100, 0]);
    expect(r.lastMonth).toBe(2);
  });

  it('detecta cobrança recorrente nova (2 meses, mesmo valor, começou há < 60 dias)', () => {
    const subs = detectNewSubscriptions(
      [
        { date: '2026-10-05', amount: -39.9, description: 'STREAMING XYZ 1234' },
        { date: '2026-11-05', amount: -39.9, description: 'STREAMING XYZ 5678' },
        { date: '2026-08-10', amount: -20, description: 'ANTIGA' },
        { date: '2026-09-10', amount: -20, description: 'ANTIGA' },
        { date: '2026-10-10', amount: -20, description: 'ANTIGA' },
      ],
      '2026-11-07',
    );
    expect(subs).toEqual([{ amount: 39.9, since: '2026-10-05' }]);
  });

  it('barra número que não está nos fatos', () => {
    const fact = { data: { gastoAteHoje: 900, limite: 1200 } } as never;
    expect(numbersAreGrounded('Você gastou R$ 900,00 de R$ 1.200,00', fact)).toBe(true);
    expect(numbersAreGrounded('Você vai gastar R$ 1.380,00', fact)).toBe(false);
  });
});

import { normalizeCategory, CARD_TX_CATEGORIES } from '../src/lib/categories';

describe('categorias unificadas', () => {
  it('normaliza grafias antigas e subcategorias do cartão alimentação', () => {
    expect(normalizeCategory('saúde')).toBe('saude');
    expect(normalizeCategory('Mercado')).toBe('alimentação');
    expect(normalizeCategory('compras')).toBe('compras');
    expect(normalizeCategory(null)).toBe('outros');
  });
  it('cartão de crédito usa as categorias gerais (menos a própria fatura)', () => {
    expect(CARD_TX_CATEGORIES).toContain('moradia');
    expect(CARD_TX_CATEGORIES).toContain('compras');
    expect(CARD_TX_CATEGORIES).not.toContain('cartão');
  });
});

import { withRetry } from '../src/lib/pluggy/sync';

describe('sync: retry em falha de rede', () => {
  it('tenta de novo em ECONNRESET e desiste em erro de dado', async () => {
    let calls = 0;
    const flaky = () => {
      calls++;
      if (calls < 2) return Promise.reject(Object.assign(new Error('Failed query'), { cause: new TypeError('fetch failed') }));
      return Promise.resolve('ok');
    };
    expect(await withRetry(flaky)).toBe('ok');
    expect(calls).toBe(2);

    let dataCalls = 0;
    await expect(withRetry(() => { dataCalls++; return Promise.reject(new Error('UNIQUE constraint failed')); })).rejects.toThrow();
    expect(dataCalls).toBe(1);
  });
});

import { billMatchesCard, parseTerms } from '../src/lib/cards';
import { pickOpenBill } from '../src/lib/pluggy/client';

describe('cartões planejados', () => {
  it('reconhece a fatura pelo nome, sem acento e sem diferenciar maiúsculas', () => {
    const itau = parseTerms('itau');
    expect(billMatchesCard({ name: 'BANCO ITAÚ', cardNickname: null }, itau)).toBe(true);
    expect(billMatchesCard({ name: 'FATURA BANCO INTER NOV/26', cardNickname: 'Banco Inter' }, parseTerms('inter'))).toBe(true);
    expect(billMatchesCard({ name: 'BANCO INTER', cardNickname: '' }, itau)).toBe(false);
    expect(billMatchesCard({ name: 'QUALQUER', cardNickname: null }, [])).toBe(false);
  });

  it('fatura em aberto = vencimento mais próximo a partir de hoje', () => {
    const bills = [
      { id: 'a', dueDate: '2026-10-13T00:00:00.000Z', totalAmount: 3214.39 },
      { id: 'b', dueDate: '2026-11-10T00:00:00.000Z', totalAmount: 3229.33 },
      { id: 'c', dueDate: '2026-09-10T00:00:00.000Z', totalAmount: 4159.13 },
    ];
    expect(pickOpenBill(bills, '2026-11-07')?.totalAmount).toBe(3229.33);
    expect(pickOpenBill(bills, '2026-11-11')).toBeNull();
  });
});
