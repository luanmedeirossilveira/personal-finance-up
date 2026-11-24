import { describe, it, expect } from 'vitest';
import {
  type CardTxLike,
  filterCardTransactions,
  isCardTxFilterActive,
  moveItem,
  sortCardTransactions,
  summarizeChecked,
} from '../src/lib/card-transactions-shared';

let nextId = 1;
const tx = (over: Partial<CardTxLike> = {}): CardTxLike => ({
  id: nextId++,
  name: 'COMPRA',
  amount: 10,
  installment: null,
  recurring: false,
  date: null,
  position: null,
  checked: false,
  ...over,
});

describe('fatura do cartão: ordem', () => {
  it('sem ordem manual, data mais recente primeiro e desempate por id', () => {
    const a = tx({ id: 1, date: '2026-11-03' });
    const b = tx({ id: 2, date: '2026-11-10' });
    const c = tx({ id: 3, date: '2026-11-03' });
    const d = tx({ id: 4, date: null });
    expect(sortCardTransactions([a, b, c, d]).map((t) => t.id)).toEqual([2, 3, 1, 4]);
  });

  it('com posição vem antes das sem posição, na ordem da posição', () => {
    const a = tx({ id: 1, date: '2026-11-20', position: null });
    const b = tx({ id: 2, date: '2026-11-01', position: 1 });
    const c = tx({ id: 3, date: '2026-11-15', position: 0 });
    expect(sortCardTransactions([a, b, c]).map((t) => t.id)).toEqual([3, 2, 1]);
  });

  it('não altera a lista original', () => {
    const list = [tx({ id: 1, position: 1 }), tx({ id: 2, position: 0 })];
    sortCardTransactions(list);
    expect(list.map((t) => t.id)).toEqual([1, 2]);
  });

  it('move um item para outra posição', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b'], 1, 9)).toEqual(['a', 'b']);
  });
});

describe('fatura do cartão: filtros', () => {
  const uber = tx({ name: 'UBER *TRIP', amount: 23.5 });
  const padaria = tx({ name: 'Padaria São João', amount: 49.9, checked: true });
  const tv = tx({ name: 'NETFLIX', amount: 55.9, recurring: true });
  const geladeira = tx({ name: 'MAGALU', amount: 400, installment: '2/10' });
  const all = [uber, padaria, tv, geladeira];

  it('busca no nome sem acento e sem diferenciar maiúsculas', () => {
    expect(filterCardTransactions(all, { query: 'sao joao' })).toEqual([padaria]);
    expect(filterCardTransactions(all, { query: 'uber' })).toEqual([uber]);
  });

  it('busca pelo valor com vírgula, ponto ou só a parte inteira', () => {
    expect(filterCardTransactions(all, { query: '49,90' })).toEqual([padaria]);
    expect(filterCardTransactions(all, { query: '49.9' })).toEqual([padaria]);
    expect(filterCardTransactions(all, { query: '49' })).toEqual([padaria]);
    expect(filterCardTransactions(all, { query: 'R$ 400' })).toEqual([geladeira]);
    expect(filterCardTransactions(all, { query: '4' })).toEqual([]);
  });

  it('filtra por tipo', () => {
    expect(filterCardTransactions(all, { kind: 'avista' })).toEqual([uber, padaria]);
    expect(filterCardTransactions(all, { kind: 'parcelada' })).toEqual([geladeira]);
    expect(filterCardTransactions(all, { kind: 'recorrente' })).toEqual([tv]);
    expect(filterCardTransactions(all, { kind: 'all' })).toEqual(all);
  });

  it('mostra só as não conferidas', () => {
    expect(filterCardTransactions(all, { onlyUnchecked: true })).toEqual([uber, tv, geladeira]);
  });

  it('sabe quando há filtro ativo', () => {
    expect(isCardTxFilterActive({})).toBe(false);
    expect(isCardTxFilterActive({ query: '  ', kind: 'all' })).toBe(false);
    expect(isCardTxFilterActive({ query: 'uber' })).toBe(true);
    expect(isCardTxFilterActive({ kind: 'recorrente' })).toBe(true);
    expect(isCardTxFilterActive({ onlyUnchecked: true })).toBe(true);
  });
});

describe('fatura do cartão: conferência', () => {
  it('conta e soma conferidas e pendentes', () => {
    const list = [tx({ amount: 10, checked: true }), tx({ amount: 5.5 }), tx({ amount: 4.5, checked: true })];
    expect(summarizeChecked(list)).toEqual({ count: 3, checkedCount: 2, checkedTotal: 14.5, pendingTotal: 5.5 });
  });
});
