// Simula o gateway: assina uma mensagem e chama o webhook (dev server ligado).
// Uso: bunx tsx scripts/wa-simulate.ts "quanto sobrou esse mês?" [http://localhost:3000]
import "dotenv/config";
import { signPayload } from "../src/lib/whatsapp/verify";

async function main() {
  const text = process.argv[2] ?? "ajuda";
  const base = process.argv[3] ?? "http://localhost:3000";
  const secret = process.env.WA_SHARED_SECRET;
  const from = process.env.WA_OWNER_NUMBER;
  if (!secret || !from) throw new Error("Defina WA_SHARED_SECRET e WA_OWNER_NUMBER no .env");

  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = JSON.stringify({ messageId: `sim-${Date.now()}`, from, text, timestamp: Number(timestamp) });
  const started = Date.now();
  const res = await fetch(`${base}/api/whatsapp/inbound`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Timestamp": timestamp,
      "X-Gateway-Signature": signPayload(secret, timestamp, rawBody),
    },
    body: rawBody,
  });
  const body = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
  console.log(`HTTP ${res.status} em ${Date.now() - started}ms\n`);
  console.log(body.reply ?? body.error ?? body);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
