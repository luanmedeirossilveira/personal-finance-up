import { describe, it, expect, vi } from 'vitest';
import { renderMonthExport, summarize, type MonthExport } from '../src/lib/month-export';

// O módulo importa o cliente do banco; o teste só usa a renderização (vi.mock é içado).
vi.mock('@/lib/db', () => ({ db: {}, schema: {} }));

const bill = (over: Partial<MonthExport['bills'][number]>): MonthExport['bills'][number] => ({
  name: 'Conta',
  amount: 100,
  category: 'moradia',
  ownership: 'joint',
  dueDay: 10,
  date: null,
  isPaid: true,
  installment: null,
  type: 'NORMAL',
  ...over,
});

const base: MonthExport = {
  month: 12,
  year: 2026,
  generatedAt: '2026-11-16',
  closed: false,
  salaries: [{ person: 'Eu', amount: 5000 }],
  bills: [
    bill({ name: 'Aluguel', amount: 2000 }),
    bill({ name: 'Aporte', amount: 500, category: 'investimentos' }),
    bill({ name: 'Nubank', amount: 800, category: 'cartão', type: 'CARD', isPaid: false }),
  ],
  invoices: [
    {
      name: 'Nubank',
      total: 800,
      undetailed: 100,
      purchases: [
        { name: 'Notebook', amount: 600, category: 'compras', date: '2026-11-02', installment: '2/10', recurring: false },
        { name: 'Streaming', amount: 100, category: 'assinaturas', date: null, installment: null, recurring: true },
      ],
    },
  ],
  meal: { limit: 0, spent: 0, purchases: [] },
  byCategory: { moradia: 2000, investimentos: 500, compras: 600, assinaturas: 100, cartão: 100 },
  budgets: { compras: 500 },
  cards: [],
  bank: null,
  future: [],
  installments: [600, 600, 600, 600, 600, 600],
  recurringMonthly: 100,
  debts: [],
  history: [
    { month: 9, year: 2026, closed: true, totals: { income: 5000, outflow: 2500, invested: 0, byCategory: { moradia: 2000 } } },
    { month: 10, year: 2026, closed: true, totals: { income: 5000, outflow: 2600, invested: 0, byCategory: { moradia: 2000 } } },
    { month: 11, year: 2026, closed: false, totals: { income: 5000, outflow: 2700, invested: 300, byCategory: { moradia: 2000 } } },
  ],
};

describe('exportação do mês', () => {
  it('tira investimentos das saídas e soma o que falta pagar', () => {
    expect(summarize(base)).toEqual({ income: 5000, outflow: 2800, invested: 500, pending: 800, balance: 1700 });
  });

  it('gera as seções com valores em BRL', () => {
    const md = renderMonthExport(base);
    expect(md).toContain('# Finanças de Dezembro/2026');
    expect(md).toContain('- Saídas (sem investimentos): R$ 2.800,00');
    expect(md).toContain('### Nubank — fatura de R$ 800,00');
    expect(md).toContain('| Notebook | R$ 600,00 | Compras | 02/11/2026 | 2/10 |  |');
    expect(md).toContain('| (não detalhado) | R$ 100,00 |');
    expect(md).toContain('| Compras | R$ 600,00 | R$ 500,00 | 120% |');
    expect(md).toContain('| Janeiro/2027 | R$ 600,00 |');
    expect(md).toContain('R$ 100,00/mês');
    expect(md).toContain('|  | set/26 | out/26 | nov/26* | dez/26 (este) |');
  });

  it('mostra "—" nas seções vazias', () => {
    const md = renderMonthExport({ ...base, debts: [], future: [], cards: [] });
    expect(md).toMatch(/## Dívidas\n—/);
    expect(md).toMatch(/## Contas previstas \(ainda não lançadas\)\n—/);
    expect(md).toMatch(/## Limites planejados por cartão\n—/);
  });
});
