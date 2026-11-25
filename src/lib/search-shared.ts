// Busca por nome ou valor (sem DB): usada na fatura do cartão e na lista de contas do Mês.

export const foldText = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// "49,90", "49.90" e "49" acham 49.90; o resto busca no nome (sem acento/caixa).
export function matchesNameOrAmount(t: { name: string; amount: number }, query: string): boolean {
  const q = foldText(query.trim());
  if (!q) return true;
  if (foldText(t.name).includes(q)) return true;
  const numeric = q.replace(/^r\$\s*/, "").replace(/\s/g, "");
  if (!/^\d+([.,]\d{0,2})?$/.test(numeric)) return false;
  const [int, dec] = numeric.replace(",", ".").split(".");
  const fixed = t.amount.toFixed(2);
  const [tInt, tDec] = fixed.split(".");
  if (int !== tInt) return false;
  return !dec || tDec.startsWith(dec);
}
