// Leitura de extrato OFX/CSV (contas da esposa, fora do Pluggy). Puro: roda no servidor e em testes.
// Deduplicação: OFX traz FITID (chave única). CSV não tem identificador → hash de data + valor + descrição.
import { createHash } from "node:crypto";

export interface ParsedTransaction {
  externalId: string;
  date: string; // YYYY-MM-DD
  amount: number; // negativo = saída
  description: string;
  category: string | null;
}

function ofxTag(block: string, tag: string) {
  // OFX 1.x (SGML) não fecha tags; OFX 2.x (XML) fecha. Lê até "<" ou quebra de linha.
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  return m ? m[1].trim() : null;
}

function ofxDate(raw: string) {
  // YYYYMMDD[HHMMSS[.XXX][TZ]]
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

export function parseOFX(text: string): ParsedTransaction[] {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const out: ParsedTransaction[] = [];
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0];
    const dt = ofxTag(block, "DTPOSTED");
    const amt = ofxTag(block, "TRNAMT");
    if (!dt || !amt) continue;
    const amount = Number.parseFloat(amt.replace(",", "."));
    if (!Number.isFinite(amount)) continue;
    const description = ofxTag(block, "MEMO") || ofxTag(block, "NAME") || "Sem descrição";
    const date = ofxDate(dt);
    const fitid = ofxTag(block, "FITID");
    out.push({
      externalId: fitid ? `ofx:${fitid}` : hashKey(date, amount, description),
      date,
      amount,
      description,
      category: suggestCategory(description),
    });
  }
  return out;
}

export function hashKey(date: string, amount: number, description: string) {
  const norm = description.trim().toLowerCase().replace(/\s+/g, " ");
  return `csv:${createHash("sha1").update(`${date}|${amount.toFixed(2)}|${norm}`).digest("hex").slice(0, 24)}`;
}

function splitCSVLine(line: string, sep: string) {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      cells.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function parseBRNumber(raw: string) {
  let v = raw.replace(/R\$|\s/g, "");
  // 1.234,56 → 1234.56 ; 1234.56 fica
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  return Number.parseFloat(v);
}

function parseCSVDate(raw: string) {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

// Aceita os formatos comuns de banco: separador ; ou , ; colunas data, descrição/histórico, valor
// (ou débito/crédito separados). O cabeçalho é detectado por nome.
export function parseCSV(text: string): ParsedTransaction[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitCSVLine(lines[0], sep).map((h) =>
    h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
  );
  const find = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iDate = find("data", "date");
  const iDesc = find("descricao", "historico", "lancamento", "description", "memo");
  const iAmount = find("valor", "amount", "quantia");
  const iDebit = find("debito", "saida");
  const iCredit = find("credito", "entrada");
  if (iDate < 0 || iDesc < 0 || (iAmount < 0 && iDebit < 0 && iCredit < 0)) return [];

  const out: ParsedTransaction[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCSVLine(line, sep);
    const date = parseCSVDate(cells[iDate] ?? "");
    if (!date) continue;
    let amount: number;
    if (iAmount >= 0 && cells[iAmount]) {
      amount = parseBRNumber(cells[iAmount]);
    } else {
      const debit = iDebit >= 0 && cells[iDebit] ? Math.abs(parseBRNumber(cells[iDebit])) : 0;
      const credit = iCredit >= 0 && cells[iCredit] ? Math.abs(parseBRNumber(cells[iCredit])) : 0;
      amount = credit - debit;
    }
    if (!Number.isFinite(amount) || amount === 0) continue;
    const description = cells[iDesc] || "Sem descrição";
    out.push({ externalId: hashKey(date, amount, description), date, amount, description, category: suggestCategory(description) });
  }
  return out;
}

export function parseStatement(fileName: string, text: string) {
  if (/\.ofx$/i.test(fileName) || /<OFX>/i.test(text)) return parseOFX(text);
  return parseCSV(text);
}

const CATEGORY_HINTS: [RegExp, string][] = [
  [/mercado|supermerc|padaria|ifood|restaurante|lanchonete|acougue|hortifruti/i, "alimentação"],
  [/uber|99 ?app|posto|combust|shell|ipiranga|estaciona|pedagio|sem parar/i, "transporte"],
  [/farmacia|drogaria|droga raia|hospital|clinica|laborat|unimed/i, "saude"],
  [/netflix|spotify|prime|disney|hbo|max\b|youtube|icloud|google one|assinatura/i, "assinaturas"],
  [/aluguel|condominio|energia|enel|sabesp|luz|agua|gas |internet|vivo|claro|tim\b/i, "moradia"],
  [/cinema|show|ingresso|bar\b|viagem|hotel|airbnb/i, "lazer"],
  [/renner|zara|riachuelo|c&a|shein|roupa|calcado/i, "vestuário"],
  [/salao|barbearia|cosmet|boticario|natura|sephora/i, "beleza"],
  [/tesouro|cdb|aplicacao|investimento|corretora/i, "investimentos"],
];

export function suggestCategory(description: string): string | null {
  const d = description.normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [re, cat] of CATEGORY_HINTS) if (re.test(d)) return cat;
  return null;
}
