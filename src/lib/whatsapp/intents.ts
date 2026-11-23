// Intents do assistente e validação dos argumentos que vêm do Gemini (ou dos atalhos).
// O Gemini só escolhe a função; tudo o que ele devolve é tratado como entrada não confiável.

export type Intent =
  | { name: "resumoMes"; args: { mes?: string } }
  | { name: "gastosPorCategoria"; args: { categoria?: string; mes?: string } }
  | { name: "contasAVencer"; args: { dias: number } }
  | { name: "ultimosLancamentos"; args: { quantidade: number } }
  | { name: "registrarGasto"; args: { valor: number; descricao: string; categoria?: string; data?: string } }
  | { name: "confirmarAcao"; args: { confirmar: boolean } }
  | { name: "escolherOpcao"; args: { opcao: number } }
  | { name: "ajuda"; args: Record<string, never> }
  | { name: "naoEntendi"; args: Record<string, never> };

export type IntentName = Intent["name"];

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// "45", "45,90", "R$ 1.234,56" ou 45.9 → número.
export function toNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string") return undefined;
  let s = v.replace(/R\$|\s/gi, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return undefined;
  return Number.parseFloat(s);
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = toNumber(v);
  if (n === undefined) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const optText = (v: unknown, max = 80) => {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, max);
  return s || undefined;
};

const optMonth = (v: unknown) => (typeof v === "string" && MONTH_RE.test(v.trim()) ? v.trim() : undefined);

function optDate(v: unknown) {
  if (typeof v !== "string" || !DATE_RE.test(v.trim())) return undefined;
  const [y, m, d] = v.trim().split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 ? v.trim() : undefined; // descarta 31/02 e afins
}

function toBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export function parseIntent(name: string, raw: unknown): Intent | null {
  const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  switch (name) {
    case "resumoMes":
      return { name, args: { mes: optMonth(a.mes) } };
    case "gastosPorCategoria":
      return { name, args: { categoria: optText(a.categoria, 40), mes: optMonth(a.mes) } };
    case "contasAVencer":
      return { name, args: { dias: clampInt(a.dias, 1, 60, 7) } };
    case "ultimosLancamentos":
      return { name, args: { quantidade: clampInt(a.quantidade, 1, 20, 5) } };
    case "registrarGasto": {
      const valor = toNumber(a.valor);
      const descricao = optText(a.descricao);
      if (valor === undefined || valor <= 0 || valor > 1_000_000 || !descricao) return null;
      return {
        name,
        args: { valor: Math.round(valor * 100) / 100, descricao, categoria: optText(a.categoria, 40), data: optDate(a.data) },
      };
    }
    case "confirmarAcao": {
      const confirmar = toBool(a.confirmar);
      return confirmar === undefined ? null : { name, args: { confirmar } };
    }
    case "escolherOpcao": {
      const opcao = toNumber(a.opcao);
      return opcao === undefined || !Number.isInteger(opcao) || opcao < 1 ? null : { name, args: { opcao } };
    }
    case "ajuda":
    case "naoEntendi":
      return { name, args: {} };
    default:
      return null;
  }
}

// Atalhos sem IA: economizam cota e latência e continuam funcionando com o Gemini fora.
export function matchShortcut(text: string): Intent | null {
  const t = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s.!?]+$/, "");
  if (/^(sim|s|ok)$/.test(t)) return { name: "confirmarAcao", args: { confirmar: true } };
  if (/^(nao|n)$/.test(t)) return { name: "confirmarAcao", args: { confirmar: false } };
  if (/^ajuda$/.test(t)) return { name: "ajuda", args: {} };
  if (/^saldo$/.test(t)) return { name: "resumoMes", args: {} };
  if (/^\d{1,2}$/.test(t)) return { name: "escolherOpcao", args: { opcao: Number(t) } };
  return null;
}
