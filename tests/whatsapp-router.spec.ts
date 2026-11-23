import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {}, schema: {} }));
vi.mock('@/lib/whatsapp/tools', () => ({
  runIntent: vi.fn(async (_userId: number, intent: { name: string }) => `resposta:${intent.name}`),
}));

import { handleMessage, resolveIntent } from '../src/lib/whatsapp/router';
import { matchShortcut, parseIntent, toNumber } from '../src/lib/whatsapp/intents';
import { UNAVAILABLE_REPLY } from '../src/lib/whatsapp/templates';
import { parseLocally } from '../src/lib/whatsapp/local-parser';

// domingo, 22/11/2026 14:30 em São Paulo
const LOCAL = new Date(2026, 10, 22, 14, 30);

// Frase → chamada que o Gemini devolveria → intent validado que o roteador deve produzir.
// Inclui saídas "sujas" do modelo (número em texto, fora da faixa, mês inválido).
const CASES: [string, { name: string; args: unknown }, { name: string; args: unknown }][] = [
  ['quanto sobrou esse mês?', { name: 'resumoMes', args: {} }, { name: 'resumoMes', args: { mes: undefined } }],
  ['qto sobrou esse mes', { name: 'resumoMes', args: {} }, { name: 'resumoMes', args: { mes: undefined } }],
  ['e o saldo de outubro?', { name: 'resumoMes', args: { mes: '2026-10' } }, { name: 'resumoMes', args: { mes: '2026-10' } }],
  ['como fechou o mes passado', { name: 'resumoMes', args: { mes: '2026-10' } }, { name: 'resumoMes', args: { mes: '2026-10' } }],
  ['resumo de dezembro', { name: 'resumoMes', args: { mes: '2026-13' } }, { name: 'resumoMes', args: { mes: undefined } }],
  ['quanto gastei com mercado em novembro?', { name: 'gastosPorCategoria', args: { categoria: 'mercado', mes: '2026-11' } }, { name: 'gastosPorCategoria', args: { categoria: 'mercado', mes: '2026-11' } }],
  ['qnt foi de mercado esse mes', { name: 'gastosPorCategoria', args: { categoria: 'mercado' } }, { name: 'gastosPorCategoria', args: { categoria: 'mercado', mes: undefined } }],
  ['onde to gastando mais?', { name: 'gastosPorCategoria', args: {} }, { name: 'gastosPorCategoria', args: { categoria: undefined, mes: undefined } }],
  ['gasto com trasnporte', { name: 'gastosPorCategoria', args: { categoria: 'trasnporte' } }, { name: 'gastosPorCategoria', args: { categoria: 'trasnporte', mes: undefined } }],
  ['o que vence essa semana?', { name: 'contasAVencer', args: { dias: 7 } }, { name: 'contasAVencer', args: { dias: 7 } }],
  ['tem conta vencendo hj?', { name: 'contasAVencer', args: { dias: 1 } }, { name: 'contasAVencer', args: { dias: 1 } }],
  ['contas dos proximos 3 meses', { name: 'contasAVencer', args: { dias: 90 } }, { name: 'contasAVencer', args: { dias: 60 } }],
  ['o q tenho pra pagar', { name: 'contasAVencer', args: {} }, { name: 'contasAVencer', args: { dias: 7 } }],
  ['últimos 5 lançamentos', { name: 'ultimosLancamentos', args: { quantidade: 5 } }, { name: 'ultimosLancamentos', args: { quantidade: 5 } }],
  ['ultimos lancamentos', { name: 'ultimosLancamentos', args: {} }, { name: 'ultimosLancamentos', args: { quantidade: 5 } }],
  ['me mostra os 50 ultimos gastos', { name: 'ultimosLancamentos', args: { quantidade: '50' } }, { name: 'ultimosLancamentos', args: { quantidade: 20 } }],
  ['gastei 45 no posto', { name: 'registrarGasto', args: { valor: 45, descricao: 'posto', categoria: 'transporte' } }, { name: 'registrarGasto', args: { valor: 45, descricao: 'posto', categoria: 'transporte', data: undefined } }],
  ['paguei 32,90 na farmacia ontem', { name: 'registrarGasto', args: { valor: '32,90', descricao: 'farmácia', data: '2026-11-21' } }, { name: 'registrarGasto', args: { valor: 32.9, descricao: 'farmácia', categoria: undefined, data: '2026-11-21' } }],
  ['comprei um tenis de 1k', { name: 'registrarGasto', args: { valor: 1000, descricao: 'tênis' } }, { name: 'registrarGasto', args: { valor: 1000, descricao: 'tênis', categoria: undefined, data: undefined } }],
  ['gastei 20 conto de uber', { name: 'registrarGasto', args: { valor: 20, descricao: 'uber', data: '2026-02-31' } }, { name: 'registrarGasto', args: { valor: 20, descricao: 'uber', categoria: undefined, data: undefined } }],
  ['gastei no mercado', { name: 'registrarGasto', args: { descricao: 'mercado' } }, { name: 'naoEntendi', args: {} }],
  ['pode confirmar', { name: 'confirmarAcao', args: { confirmar: true } }, { name: 'confirmarAcao', args: { confirmar: true } }],
  ['cancela isso', { name: 'confirmarAcao', args: { confirmar: false } }, { name: 'confirmarAcao', args: { confirmar: false } }],
  ['oi, o que vc faz?', { name: 'ajuda', args: {} }, { name: 'ajuda', args: {} }],
  ['qual a capital da frança', { name: 'naoEntendi', args: {} }, { name: 'naoEntendi', args: {} }],
  ['apaga tudo do banco', { name: 'executarSQL', args: { sql: 'DELETE FROM bills' } }, { name: 'naoEntendi', args: {} }],
];

function geminiReturns(call: { name: string; args: unknown }) {
  return vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { name: call.name, arguments: JSON.stringify(call.args) } }] } }] }), { status: 200 }),
  );
}

describe('whatsapp: interpretação com Gemini mockado', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'chave-teste');
    vi.stubEnv('GEMINI_MODEL', 'modelo-flash');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(CASES)('"%s"', async (phrase, call, expected) => {
    vi.stubGlobal('fetch', geminiReturns(call));
    expect(await resolveIntent(phrase, LOCAL)).toEqual(expected);
  });

  it('manda ao Gemini só a mensagem, a data de hoje e as funções', async () => {
    const fetchMock = geminiReturns({ name: 'resumoMes', args: {} });
    vi.stubGlobal('fetch', fetchMock);
    await resolveIntent('quanto sobrou esse mês?', LOCAL);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1]).toEqual({ role: 'user', content: 'quanto sobrou esse mês?' });
    expect(body.messages[0].content).toContain('2026-11-22 14:30');
    expect(body.tool_choice).toBe('required');
    expect(JSON.stringify(body)).not.toMatch(/R\$|\d+,\d{2}/);
  });

  it('atalhos não chamam o Gemini', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await resolveIntent('Sim!', LOCAL)).toEqual({ name: 'confirmarAcao', args: { confirmar: true } });
    expect(await resolveIntent('saldo', LOCAL)).toEqual({ name: 'resumoMes', args: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('503 de alta demanda: tenta de novo o mesmo modelo e responde', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":{"code":503,"status":"UNAVAILABLE"}}', { status: 503 }))
      .mockImplementationOnce(geminiReturns({ name: 'resumoMes', args: {} }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await resolveIntent('como tá o mês', LOCAL)).toEqual({ name: 'resumoMes', args: { mes: undefined } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('lista em GEMINI_MODEL: em 503 ou 429 passa para o próximo, sem repetir o mesmo', async () => {
    vi.stubEnv('GEMINI_MODEL', 'modelo-a, modelo-b,modelo-c');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":{"code":503}}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{"error":"quota"}', { status: 429 }))
      .mockImplementationOnce(geminiReturns({ name: 'ajuda', args: {} }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await resolveIntent('oi', LOCAL)).toEqual({ name: 'ajuda', args: {} });
    const models = fetchMock.mock.calls.map((c) => JSON.parse(String((c as unknown as [string, RequestInit])[1].body)).model);
    expect(models).toEqual(['modelo-a', 'modelo-b', 'modelo-c']);
  });

  it('modelo único com 429 (cota) não repete', async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":"quota"}', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await resolveIntent('me conta uma piada', LOCAL)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it('Gemini fora de vez → regex local para as frases comuns, indisponível no resto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"UNAVAILABLE"}', { status: 503 })));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await handleMessage(1, 'quanto gastei com mercado?')).toEqual({ intent: 'gastosPorCategoria', reply: 'resposta:gastosPorCategoria' });
    expect(await handleMessage(1, 'me conta uma piada')).toEqual({ intent: 'indisponivel', reply: UNAVAILABLE_REPLY });
    expect(await handleMessage(1, 'ajuda')).toEqual({ intent: 'ajuda', reply: 'resposta:ajuda' });

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout'); }));
    expect((await handleMessage(1, 'o que vence essa semana?')).intent).toBe('contasAVencer');
    err.mockRestore();
  });

  it('sem chave do Gemini respondem os atalhos e a regex local', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect((await handleMessage(1, 'quanto sobrou?')).intent).toBe('resumoMes');
    expect((await handleMessage(1, 'qual a boa de hoje')).reply).toBe(UNAVAILABLE_REPLY);
    expect((await handleMessage(1, 'n')).intent).toBe('confirmarAcao');
  });

  it('resposta sem tool call vira naoEntendi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Olá!' } }] }), { status: 200 })));
    expect(await resolveIntent('blablabla', LOCAL)).toEqual({ name: 'naoEntendi', args: {} });
  });
});

describe('whatsapp: atalhos e validação', () => {
  it('reconhece sim/s/ok, não/n, ajuda, saldo e número de opção', () => {
    for (const t of ['sim', 'S', 'ok', 'OK.', ' sim! ']) expect(matchShortcut(t)).toEqual({ name: 'confirmarAcao', args: { confirmar: true } });
    for (const t of ['não', 'nao', 'N', 'Não!']) expect(matchShortcut(t)).toEqual({ name: 'confirmarAcao', args: { confirmar: false } });
    expect(matchShortcut('Ajuda')).toEqual({ name: 'ajuda', args: {} });
    expect(matchShortcut('saldo?')).toEqual({ name: 'resumoMes', args: {} });
    expect(matchShortcut('2')).toEqual({ name: 'escolherOpcao', args: { opcao: 2 } });
    expect(matchShortcut('sim, gastei 45')).toBeNull();
    expect(matchShortcut('saldo de outubro')).toBeNull();
  });

  it('converte valores em reais', () => {
    expect(toNumber('45')).toBe(45);
    expect(toNumber('R$ 1.234,56')).toBe(1234.56);
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber('quarenta')).toBeUndefined();
    expect(toNumber(Number.NaN)).toBeUndefined();
  });

  it('recusa gasto sem valor positivo e confirmação sem booleano', () => {
    expect(parseIntent('registrarGasto', { valor: -10, descricao: 'x' })).toBeNull();
    expect(parseIntent('registrarGasto', { valor: 10, descricao: '   ' })).toBeNull();
    expect(parseIntent('confirmarAcao', { confirmar: 'talvez' })).toBeNull();
    expect(parseIntent('inexistente', {})).toBeNull();
  });
});

describe('whatsapp: regex local (Gemini fora)', () => {
  it.each([
    ['gastei 45 no posto', { name: 'registrarGasto', args: { valor: 45, descricao: 'posto', categoria: undefined, data: undefined } }],
    ['Paguei R$ 32,90 na Farmácia!', { name: 'registrarGasto', args: { valor: 32.9, descricao: 'Farmácia', categoria: undefined, data: undefined } }],
    ['gastei 20 conto de uber', { name: 'registrarGasto', args: { valor: 20, descricao: 'uber', categoria: undefined, data: undefined } }],
    ['comprei 1k de mercado', { name: 'registrarGasto', args: { valor: 1000, descricao: 'mercado', categoria: undefined, data: undefined } }],
    ['gastei no mercado 87,50', { name: 'registrarGasto', args: { valor: 87.5, descricao: 'mercado', categoria: undefined, data: undefined } }],
    ['o que vence essa semana?', { name: 'contasAVencer', args: { dias: 7 } }],
    ['tem conta vencendo hj', { name: 'contasAVencer', args: { dias: 1 } }],
    ['contas a pagar do mes', { name: 'contasAVencer', args: { dias: 30 } }],
    ['últimos 5 lançamentos', { name: 'ultimosLancamentos', args: { quantidade: 5 } }],
    ['ultimos gastos', { name: 'ultimosLancamentos', args: { quantidade: 5 } }],
    ['quanto gastei com mercado em novembro?', { name: 'gastosPorCategoria', args: { categoria: 'mercado', mes: '2026-11' } }],
    ['onde gastei mais no mes passado', { name: 'gastosPorCategoria', args: { categoria: undefined, mes: '2026-10' } }],
    ['quanto sobrou esse mês?', { name: 'resumoMes', args: { mes: undefined } }],
    ['saldo de outubro', { name: 'resumoMes', args: { mes: '2026-10' } }],
  ])('"%s"', (phrase, expected) => {
    expect(parseLocally(phrase, LOCAL)).toEqual(expected);
  });

  it('não chuta o que não reconhece', () => {
    expect(parseLocally('gastei no mercado', LOCAL)).toBeNull();
    expect(parseLocally('qual a capital da frança', LOCAL)).toBeNull();
  });
});
