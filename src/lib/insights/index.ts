// Insights da semana: fatos (regras) → Gemini redige e prioriza → fallback com as frases-modelo.
// Guardados em `insights` com voto útil / não útil; tipos que você ignora saem do ranking.
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { db, schema } from "@/lib/db";
import { computeFacts, type Fact } from "./facts";
import { isGeminiConfigured, writeInsightsWithGemini } from "./gemini";

export interface StoredInsight {
  id: number;
  type: string;
  tone: "positive" | "warning" | "negative";
  title: string;
  message: string;
  action: string | null;
  source: "rules" | "ai";
  vote: number | null;
}

// Tipos com 2+ votos "não útil" e nenhum "útil" nas últimas 8 semanas são cortados.
async function mutedTypes(userId: number, now: Date) {
  const since = new Date(now);
  since.setDate(since.getDate() - 56);
  const votes = await db.query.insights.findMany({
    where: and(
      eq(schema.insights.userId, userId),
      isNotNull(schema.insights.vote),
      gte(schema.insights.createdAt, since.toISOString().slice(0, 19).replace("T", " ")),
    ),
  });
  const tally = new Map<string, { up: number; down: number }>();
  for (const v of votes) {
    const t = tally.get(v.type) ?? { up: 0, down: 0 };
    if (v.vote === 1) t.up++;
    if (v.vote === -1) t.down++;
    tally.set(v.type, t);
  }
  return new Set(Array.from(tally.entries()).filter(([, t]) => t.down >= 2 && t.up === 0).map(([type]) => type));
}

export async function generateWeeklyInsights(userId: number, now = new Date()) {
  const muted = await mutedTypes(userId, now);
  const facts = (await computeFacts(userId, now)).filter((f) => !muted.has(f.type));
  const weekNumber = getISOWeek(now);
  const year = getISOWeekYear(now);

  let chosen: { fact: Fact; title: string; message: string; action: string; source: "rules" | "ai" }[] = [];
  if (facts.length > 0 && isGeminiConfigured()) {
    try {
      const written = await writeInsightsWithGemini(facts);
      chosen = written.map((w) => ({
        fact: facts.find((f) => f.type === w.type)!,
        title: w.title,
        message: w.message,
        action: w.action,
        source: "ai" as const,
      }));
    } catch (e) {
      console.error("Gemini insights fallback:", (e as Error).message);
    }
  }
  // Fallback (ou complemento até 3): frases-modelo da camada 1.
  for (const f of facts) {
    if (chosen.length >= 3) break;
    if (chosen.some((c) => c.fact.type === f.type)) continue;
    chosen.push({ fact: f, title: f.title, message: f.message, action: f.action, source: "rules" });
  }

  // Regera a semana sem apagar o que já recebeu voto.
  const existing = await db.query.insights.findMany({
    where: and(eq(schema.insights.userId, userId), eq(schema.insights.weekNumber, weekNumber), eq(schema.insights.year, year)),
  });
  for (const e of existing.filter((e) => e.vote === null)) {
    await db.delete(schema.insights).where(eq(schema.insights.id, e.id));
  }
  const kept = existing.filter((e) => e.vote !== null);

  const rows = chosen.filter((c) => !kept.some((k) => k.type === c.fact.type));
  if (rows.length > 0) {
    await db.insert(schema.insights).values(
      rows.map((c, i) => ({
        userId,
        weekNumber,
        year,
        type: c.fact.type,
        tone: c.fact.tone,
        title: c.title,
        message: c.message,
        action: c.action,
        facts: JSON.stringify(c.fact.data),
        source: c.source,
        rank: i,
      })),
    );
  }
  return getWeekInsights(userId, now);
}

export async function getWeekInsights(userId: number, now = new Date()): Promise<StoredInsight[]> {
  const rows = await db.query.insights.findMany({
    where: and(
      eq(schema.insights.userId, userId),
      eq(schema.insights.weekNumber, getISOWeek(now)),
      eq(schema.insights.year, getISOWeekYear(now)),
    ),
    orderBy: [schema.insights.rank],
  });
  return rows.map(toStored);
}

export async function latestInsights(userId: number, limit = 3): Promise<StoredInsight[]> {
  const latest = await db.query.insights.findFirst({
    where: eq(schema.insights.userId, userId),
    orderBy: [desc(schema.insights.createdAt)],
  });
  if (!latest) return [];
  const rows = await db.query.insights.findMany({
    where: and(
      eq(schema.insights.userId, userId),
      eq(schema.insights.weekNumber, latest.weekNumber),
      eq(schema.insights.year, latest.year),
    ),
    orderBy: [schema.insights.rank],
    limit,
  });
  return rows.map(toStored);
}

function toStored(r: typeof schema.insights.$inferSelect): StoredInsight {
  return {
    id: r.id,
    type: r.type,
    tone: r.tone,
    title: r.title,
    message: r.message,
    action: r.action,
    source: r.source,
    vote: r.vote,
  };
}
