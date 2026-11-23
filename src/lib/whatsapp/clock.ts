// A Vercel roda em UTC; "hoje", "ontem" e "esse mês" do assistente seguem o relógio de São Paulo.
// Devolve um Date cujos campos locais (getDate, getMonth…) são a hora de parede em São Paulo,
// no mesmo formato que os helpers de lib/month.ts e lib/upcoming.ts esperam.
export const TIME_ZONE = "America/Sao_Paulo";

export function saoPauloNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}
