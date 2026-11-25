import { describe, it, expect } from 'vitest';
import {
  type NameHistoryRow,
  type NameSuggestion,
  buildNameSuggestions,
  matchNameSuggestions,
} from '../src/lib/name-suggestions-shared';

const row = (over: Partial<NameHistoryRow> = {}): NameHistoryRow => ({
  name: 'PADARIA',
  category: null,
  amount: 10,
  usedAt: '2026-11-01',
  ...over,
});

const sug = (over: Partial<NameSuggestion> = {}): NameSuggestion => ({
  name: 'PADARIA',
  category: null,
  lastAmount: 10,
  fixedAmount: null,
  count: 1,
  lastUsed: '2026-11-01',
  ...over,
});

describe('sugestão de descrição: histórico', () => {
  it('agrupa ignorando caixa, acento e espaço e usa a grafia mais recente', () => {
    const [s, ...rest] = buildNameSuggestions([
      row({ name: 'Padaria do Zé', usedAt: '2026-10-01' }),
      row({ name: 'PADARIA  DO ZE', usedAt: '2026-11-10' }),
    ]);
    expect(rest).toHaveLength(0);
    expect(s).toMatchObject({ name: 'PADARIA  DO ZE', count: 2, lastUsed: '2026-11-10' });
  });

  it('pega a categoria mais recente preenchida', () => {
    const [s] = buildNameSuggestions([
      row({ category: 'lazer', usedAt: '2026-09-01' }),
      row({ category: 'alimentação', usedAt: '2026-10-01' }),
      row({ category: null, usedAt: '2026-11-01' }),
    ]);
    expect(s.category).toBe('alimentação');
  });

  it('sugere o valor só quando as últimas compras se repetem iguais', () => {
    const [spotify] = buildNameSuggestions([
      row({ name: 'SPOTIFY', amount: 21.9, usedAt: '2026-09-05' }),
      row({ name: 'SPOTIFY', amount: 21.9, usedAt: '2026-10-05' }),
      row({ name: 'SPOTIFY', amount: 21.9, usedAt: '2026-11-05' }),
    ]);
    expect(spotify.fixedAmount).toBe(21.9);

    const [mercado] = buildNameSuggestions([
      row({ name: 'MERCADO', amount: 120, usedAt: '2026-10-05' }),
      row({ name: 'MERCADO', amount: 87.4, usedAt: '2026-11-05' }),
    ]);
    expect(mercado).toMatchObject({ fixedAmount: null, lastAmount: 87.4 });

    expect(buildNameSuggestions([row({ name: 'UMA VEZ' })])[0].fixedAmount).toBeNull();
  });

  it('considera só as compras recentes para o valor fixo (reajuste antigo não atrapalha)', () => {
    const [s] = buildNameSuggestions([
      row({ name: 'NETFLIX', amount: 39.9, usedAt: '2026-07-01' }),
      row({ name: 'NETFLIX', amount: 44.9, usedAt: '2026-09-01' }),
      row({ name: 'NETFLIX', amount: 44.9, usedAt: '2026-10-01' }),
      row({ name: 'NETFLIX', amount: 44.9, usedAt: '2026-11-01' }),
    ]);
    expect(s.fixedAmount).toBe(44.9);
  });

  it('ordena pela mais usada e ignora nome vazio', () => {
    const list = buildNameSuggestions([
      row({ name: 'UBER' }),
      row({ name: 'IFOOD' }),
      row({ name: 'UBER' }),
      row({ name: '   ' }),
    ]);
    expect(list.map((s) => s.name)).toEqual(['UBER', 'IFOOD']);
  });
});

describe('sugestão de descrição: filtro pelo que foi digitado', () => {
  const list = [
    sug({ name: 'POSTO SHELL', count: 2 }),
    sug({ name: 'SHELL SELECT', count: 1 }),
    sug({ name: 'AUTOSHELL LAVAGEM', count: 3 }),
    sug({ name: 'MICHELLE SALÃO', count: 9 }),
    sug({ name: 'SUPERMERCADO DIA', count: 5 }),
  ];

  it('prioriza começo do nome, depois começo de palavra, depois contém', () => {
    expect(matchNameSuggestions(list, 'shell').map((s) => s.name)).toEqual(['SHELL SELECT', 'POSTO SHELL', 'AUTOSHELL LAVAGEM']);
  });

  it('ignora caixa e acento no que foi digitado', () => {
    expect(matchNameSuggestions(list, 'salao').map((s) => s.name)).toEqual(['MICHELLE SALÃO']);
    expect(matchNameSuggestions(list, 'Súper').map((s) => s.name)).toEqual(['SUPERMERCADO DIA']);
  });

  it('sem texto mostra as mais usadas, respeitando o limite', () => {
    expect(matchNameSuggestions(list, '  ', 2).map((s) => s.name)).toEqual(['MICHELLE SALÃO', 'SUPERMERCADO DIA']);
  });

  it('sem nada parecido devolve vazio', () => {
    expect(matchNameSuggestions(list, 'xpto')).toEqual([]);
  });
});
