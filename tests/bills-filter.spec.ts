import { describe, it, expect } from 'vitest';
import {
  type BillLike,
  billCategoriesPresent,
  filterBills,
  isBillFilterActive,
  isBillOverdue,
} from '../src/lib/bills-filter-shared';

const bill = (over: Partial<BillLike> = {}): BillLike => ({
  name: 'CONTA',
  amount: 100,
  isPaid: false,
  dueDay: null,
  category: 'outros',
  type: 'NORMAL',
  installment: null,
  ...over,
});

const names = (list: BillLike[]) => list.map((b) => b.name);

describe('contas do mês: busca', () => {
  it('acha pelo nome sem acento nem caixa', () => {
    const list = [bill({ name: 'Condomínio' }), bill({ name: 'Luz' })];
    expect(names(filterBills(list, { query: 'condominio' }, null))).toEqual(['Condomínio']);
    expect(names(filterBills(list, { query: 'LUZ' }, null))).toEqual(['Luz']);
  });

  it('acha pelo valor com vírgula, ponto ou só a parte inteira', () => {
    const list = [bill({ name: 'A', amount: 49.9 }), bill({ name: 'B', amount: 149.9 })];
    expect(names(filterBills(list, { query: '49,90' }, null))).toEqual(['A']);
    expect(names(filterBills(list, { query: '49.9' }, null))).toEqual(['A']);
    expect(names(filterBills(list, { query: 'R$ 149' }, null))).toEqual(['B']);
  });
});

describe('contas do mês: situação', () => {
  const list = [
    bill({ name: 'paga', isPaid: true, dueDay: 5 }),
    bill({ name: 'vencida', dueDay: 5 }),
    bill({ name: 'a vencer', dueDay: 20 }),
    bill({ name: 'sem dia' }),
  ];

  it('separa a pagar de pagas', () => {
    expect(names(filterBills(list, { status: 'paid' }, 10))).toEqual(['paga']);
    expect(names(filterBills(list, { status: 'pending' }, 10))).toEqual(['vencida', 'a vencer', 'sem dia']);
  });

  it('vencida é a não paga com dia antes de hoje, só no mês corrente', () => {
    expect(names(filterBills(list, { status: 'overdue' }, 10))).toEqual(['vencida']);
    expect(filterBills(list, { status: 'overdue' }, null)).toEqual([]);
    expect(isBillOverdue(bill({ dueDay: 10 }), 10)).toBe(false);
  });
});

describe('contas do mês: categoria, tipo e parcela', () => {
  it('normaliza a categoria e trata fatura sem categoria como cartão', () => {
    const list = [
      bill({ name: 'médico', category: 'saúde' }),
      bill({ name: 'fatura', type: 'CARD', category: null }),
      bill({ name: 'viagem', category: 'viagem' }),
    ];
    expect(names(filterBills(list, { category: 'saude' }, null))).toEqual(['médico']);
    expect(names(filterBills(list, { category: 'cartão' }, null))).toEqual(['fatura']);
  });

  it('tipo ausente conta como conta normal', () => {
    const list = [bill({ name: 'luz', type: null }), bill({ name: 'nubank', type: 'CARD' })];
    expect(names(filterBills(list, { type: 'NORMAL' }, null))).toEqual(['luz']);
    expect(names(filterBills(list, { type: 'CARD' }, null))).toEqual(['nubank']);
  });

  it('só parceladas ignora parcela em branco', () => {
    const list = [bill({ name: 'carro', installment: '3/48' }), bill({ name: 'luz', installment: ' ' })];
    expect(names(filterBills(list, { onlyInstallment: true }, null))).toEqual(['carro']);
  });

  it('combina os filtros', () => {
    const list = [
      bill({ name: 'IPVA 1/3', category: 'carro', installment: '1/3', isPaid: true }),
      bill({ name: 'IPVA 2/3', category: 'carro', installment: '2/3' }),
      bill({ name: 'Oficina', category: 'carro' }),
    ];
    expect(
      names(filterBills(list, { query: 'ipva', category: 'carro', onlyInstallment: true, status: 'pending' }, null)),
    ).toEqual(['IPVA 2/3']);
  });
});

describe('contas do mês: estado do filtro', () => {
  it('considera ativo qualquer filtro fora do padrão', () => {
    expect(isBillFilterActive({})).toBe(false);
    expect(isBillFilterActive({ query: '  ', status: 'all', category: 'all', type: 'all', onlyInstallment: false })).toBe(false);
    expect(isBillFilterActive({ query: 'luz' })).toBe(true);
    expect(isBillFilterActive({ status: 'paid' })).toBe(true);
    expect(isBillFilterActive({ category: 'viagem' })).toBe(true);
    expect(isBillFilterActive({ type: 'CARD' })).toBe(true);
    expect(isBillFilterActive({ onlyInstallment: true })).toBe(true);
  });

  it('lista as categorias presentes sem repetir, na ordem dos selects', () => {
    const list = [bill({ category: 'viagem' }), bill({ category: 'moradia' }), bill({ category: 'viagem' }), bill({ category: 'saúde' })];
    expect(billCategoriesPresent(list)).toEqual(['moradia', 'saude', 'viagem']);
  });
});
