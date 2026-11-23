import { describe, it, expect } from 'vitest';
import { parseInbound, sameNumber, signPayload, verifySignature } from '../src/lib/whatsapp/verify';

const SECRET = 'segredo-compartilhado';
const NOW = 1_795_000_000;
const rawBody = JSON.stringify({ messageId: 'ABC', from: '5551999999999', text: 'saldo', timestamp: NOW });

describe('whatsapp: assinatura do gateway', () => {
  it('aceita assinatura válida dentro da janela', () => {
    const ts = String(NOW - 10);
    expect(verifySignature({ rawBody, timestamp: ts, signature: signPayload(SECRET, ts, rawBody), secret: SECRET, nowSeconds: NOW })).toEqual({ ok: true });
  });

  it('recusa assinatura de outro segredo ou de corpo re-serializado', () => {
    const ts = String(NOW);
    const outra = signPayload('outro', ts, rawBody);
    expect(verifySignature({ rawBody, timestamp: ts, signature: outra, secret: SECRET, nowSeconds: NOW })).toEqual({ ok: false, reason: 'invalid' });
    const reserializado = JSON.stringify(JSON.parse(rawBody), null, 2);
    const sig = signPayload(SECRET, ts, rawBody);
    expect(verifySignature({ rawBody: reserializado, timestamp: ts, signature: sig, secret: SECRET, nowSeconds: NOW }).ok).toBe(false);
  });

  it('recusa timestamp com mais de 300s de diferença (anti-replay)', () => {
    const velho = String(NOW - 301);
    const sig = signPayload(SECRET, velho, rawBody);
    expect(verifySignature({ rawBody, timestamp: velho, signature: sig, secret: SECRET, nowSeconds: NOW })).toEqual({ ok: false, reason: 'expired' });
    const emMs = String(NOW * 1000);
    expect(verifySignature({ rawBody, timestamp: emMs, signature: signPayload(SECRET, emMs, rawBody), secret: SECRET, nowSeconds: NOW }).ok).toBe(false);
  });

  it('recusa sem cabeçalhos ou sem segredo configurado', () => {
    expect(verifySignature({ rawBody, timestamp: null, signature: 'sha256=x', secret: SECRET, nowSeconds: NOW }).ok).toBe(false);
    expect(verifySignature({ rawBody, timestamp: String(NOW), signature: null, secret: SECRET, nowSeconds: NOW }).ok).toBe(false);
    expect(verifySignature({ rawBody, timestamp: String(NOW), signature: 'sha256=x', secret: undefined, nowSeconds: NOW }).ok).toBe(false);
  });
});

describe('whatsapp: corpo do webhook', () => {
  it('valida o contrato { messageId, from, text, timestamp }', () => {
    expect(parseInbound(JSON.parse(rawBody))).toEqual({ messageId: 'ABC', from: '5551999999999', text: 'saldo', timestamp: NOW });
    expect(parseInbound({ messageId: 'ABC', from: '555', text: 'oi', timestamp: '123' })).toBeNull();
    expect(parseInbound({ from: '555', text: 'oi', timestamp: 1 })).toBeNull();
    expect(parseInbound(null)).toBeNull();
  });

  it('compara o número do dono só pelos dígitos', () => {
    expect(sameNumber('+5551999999999', '5551999999999')).toBe(true);
    expect(sameNumber('5551988888888', '5551999999999')).toBe(false);
    expect(sameNumber('5551999999999', undefined)).toBe(false);
    expect(sameNumber('', '')).toBe(false);
  });
});
