import { describe, it, expect } from 'vitest';
import { hashKey, parseCSV, parseOFX, suggestCategory } from '../src/lib/import/statement';

const OFX = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261103120000[-3:BRT]<TRNAMT>-89.90<FITID>abc123<MEMO>PAG SUPERMERCADO DIA
</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261105<TRNAMT>3500.00<FITID>def456<NAME>SALARIO
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('importação de extrato', () => {
  it('lê OFX SGML usando FITID como chave', () => {
    const txs = parseOFX(OFX);
    expect(txs).toHaveLength(2);
    expect(txs[0]).toMatchObject({ externalId: 'ofx:abc123', date: '2026-11-03', amount: -89.9, category: 'alimentação' });
    expect(txs[1]).toMatchObject({ externalId: 'ofx:def456', date: '2026-11-05', amount: 3500, description: 'SALARIO' });
  });

  it('lê CSV brasileiro (; , decimal com vírgula) com hash estável', () => {
    const csv = 'Data;Descrição;Valor\n03/11/2026;UBER *TRIP;-23,40\n04/11/2026;"Netflix; assinatura";-55,90\n';
    const txs = parseCSV(csv);
    expect(txs).toHaveLength(2);
    expect(txs[0]).toMatchObject({ date: '2026-11-03', amount: -23.4, category: 'transporte' });
    expect(txs[1].description).toBe('Netflix; assinatura');
    expect(txs[0].externalId).toBe(hashKey('2026-11-03', -23.4, 'UBER *TRIP'));
  });

  it('lê CSV com colunas de débito e crédito separadas', () => {
    const csv = 'date,description,debito,credito\n2026-11-01,PIX recebido,,150.00\n2026-11-02,Farmacia,42.10,\n';
    const txs = parseCSV(csv);
    expect(txs.map((t) => t.amount)).toEqual([150, -42.1]);
  });

  it('sugere categoria pela descrição', () => {
    expect(suggestCategory('DROGARIA SÃO PAULO')).toBe('saude');
    expect(suggestCategory('TRANSFERENCIA')).toBeNull();
  });
});
