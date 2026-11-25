import { describe, it, expect } from 'vitest';
import { BILL_FORM_CATEGORIES } from '../src/lib/categories';
import { guessCategoryFromText, resolveCategory } from '../src/lib/whatsapp/categories';

describe('whatsapp: resolução de categoria', () => {
  it('ignora acento e caixa', () => {
    expect(resolveCategory('Alimentacao')).toEqual({ kind: 'match', category: 'alimentação' });
    expect(resolveCategory('SAÚDE')).toEqual({ kind: 'match', category: 'saude' });
    expect(resolveCategory('vestuario')).toEqual({ kind: 'match', category: 'vestuário' });
  });

  it('usa os apelidos do app e do dia a dia', () => {
    expect(resolveCategory('mercado')).toEqual({ kind: 'match', category: 'alimentação' });
    expect(resolveCategory('posto')).toEqual({ kind: 'match', category: 'transporte' });
    expect(resolveCategory('farmácia')).toEqual({ kind: 'match', category: 'saude' });
    expect(resolveCategory('gasto com uber')).toEqual({ kind: 'match', category: 'transporte' });
  });

  it('aceita erro de digitação e prefixo', () => {
    expect(resolveCategory('trasnporte')).toEqual({ kind: 'match', category: 'transporte' });
    expect(resolveCategory('assinatura')).toEqual({ kind: 'match', category: 'assinaturas' });
    expect(resolveCategory('mora')).toEqual({ kind: 'match', category: 'moradia' });
  });

  it('empate no match aproximado é ambíguo', () => {
    expect(resolveCategory('sauer')).toEqual({ kind: 'ambiguous', options: ['saude', 'lazer'] });
    expect(resolveCategory('coutras')).toEqual({ kind: 'ambiguous', options: ['compras', 'outros'] });
    expect(resolveCategory('di').kind).toBe('none'); // curto demais para aproximar
  });

  it('sem nada parecido devolve none', () => {
    expect(resolveCategory('xpto')).toEqual({ kind: 'none' });
    expect(resolveCategory('')).toEqual({ kind: 'none' });
    expect(resolveCategory(undefined)).toEqual({ kind: 'none' });
  });

  it('respeita a lista permitida (gasto novo não vira "cartão")', () => {
    expect(resolveCategory('cartão', BILL_FORM_CATEGORIES).kind).not.toBe('match');
    expect(resolveCategory('cartão')).toEqual({ kind: 'match', category: 'cartão' });
  });

  it('adivinha pela descrição só com palavra exata ou apelido', () => {
    expect(guessCategoryFromText('posto shell')).toBe('transporte');
    expect(guessCategoryFromText('almoço no centro')).toBe('alimentação');
    expect(guessCategoryFromText('presente da mãe')).toBe('compras');
    expect(guessCategoryFromText('coisa aleatória')).toBeNull();
  });

  it('separa carro e viagem de transporte e lazer', () => {
    expect(resolveCategory('ipva')).toEqual({ kind: 'match', category: 'carro' });
    expect(resolveCategory('carro')).toEqual({ kind: 'match', category: 'carro' });
    expect(guessCategoryFromText('mecânico do carro')).toBe('carro');
    expect(resolveCategory('viagem')).toEqual({ kind: 'match', category: 'viagem' });
    expect(resolveCategory('hotel')).toEqual({ kind: 'match', category: 'viagem' });
    expect(resolveCategory('posto')).toEqual({ kind: 'match', category: 'transporte' });
    expect(resolveCategory('cinema')).toEqual({ kind: 'match', category: 'lazer' });
  });
});
