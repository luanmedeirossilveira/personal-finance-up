import { describe, it, expect } from 'vitest';
import {
  type ProjectionLine,
  budgetStatus,
  projectBalance,
  remainingInBudgets,
} from '../src/lib/category-budget-shared';
import { statusColor } from '../src/lib/month';

const line = (over: Partial<ProjectionLine> = {}): ProjectionLine => ({
  source: 'conta',
  category: 'lazer',
  amount: 100,
  ...over,
});

describe('limites: faixa de cor', () => {
  it('sem limite não tem status', () => {
    expect(budgetStatus(500, null)).toBe('none');
  });

  it('verde até o limite, inclusive exatamente no limite', () => {
    expect(budgetStatus(799, 1000)).toBe('ok');
    expect(budgetStatus(1000, 1000)).toBe('ok');
    expect(budgetStatus(0.1 + 0.2, 0.3)).toBe('ok');
  });

  it('amarelo de 1 centavo acima até 10% acima', () => {
    expect(budgetStatus(1000.01, 1000)).toBe('warning');
    expect(budgetStatus(1100, 1000)).toBe('warning');
  });

  it('vermelho acima de 10%', () => {
    expect(budgetStatus(1100.01, 1000)).toBe('over');
  });

  it('statusColor segue as mesmas três faixas', () => {
    expect(statusColor(1)).toBe('rgb(var(--accent))');
    expect(statusColor(1.05)).toBe('rgb(var(--warning))');
    expect(statusColor(1.2)).toBe('rgb(var(--negative))');
  });
});

describe('limites: saldo projetado', () => {
  it('soma o que falta só nas categorias abaixo do limite', () => {
    const budgets = [
      { category: 'lazer', amount: 500 },
      { category: 'compras', amount: 300 },
    ];
    const lines = [line({ category: 'lazer', amount: 200 }), line({ category: 'compras', amount: 450 })];
    const r = remainingInBudgets(budgets, lines, 0);
    expect(r.total).toBe(300);
    expect(r.lines).toEqual([{ category: 'lazer', remaining: 300 }]);
  });

  it('categoria com limite e sem gasto conta o limite inteiro, com categoria normalizada', () => {
    expect(remainingInBudgets([{ category: 'saúde', amount: 250 }], [], 0).lines).toEqual([
      { category: 'saude', remaining: 250 },
    ]);
  });

  it('alimentação: tira o limite e o gasto do cartão alimentação da projeção', () => {
    const lines = [
      line({ source: 'alimentação', category: 'alimentação', amount: 800 }),
      line({ source: 'cartão', category: 'alimentação', amount: 300 }),
    ];
    expect(remainingInBudgets([{ category: 'alimentação', amount: 2000 }], lines, 800).total).toBe(900);
  });

  it('compra do cartão alimentação em outra categoria também fica fora', () => {
    const lines = [line({ source: 'alimentação', category: 'lazer', amount: 120 })];
    expect(remainingInBudgets([{ category: 'lazer', amount: 500 }], lines, 600).total).toBe(500);
  });

  it('limite do cartão alimentação maior que o de alimentação não deixa nada a descontar', () => {
    expect(remainingInBudgets([{ category: 'alimentação', amount: 500 }], [], 800).total).toBe(0);
  });

  it('projetado é o previsto menos o que falta', () => {
    expect(projectBalance(1500, 900)).toBe(600);
    expect(projectBalance(200, 500)).toBe(-300);
  });
});
