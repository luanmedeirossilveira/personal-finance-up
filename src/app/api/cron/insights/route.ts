import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { sendInsightsEmail } from "@/lib/email";
import { callPerplexity } from "@/lib/perplexity";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminUser = await db.query.users.findFirst();
  if (!adminUser) return NextResponse.json({ ok: true });

  // Build prompt dynamically from DB (salaries, bills)
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // fetch salaries for current month/year
  const salaries = await db.query.salaries.findMany({
    where: and(
      eq(schema.salaries.userId, adminUser.id),
      eq(schema.salaries.month, month),
      eq(schema.salaries.year, year),
    ),
  });

  // if no salaries for current month, fetch latest per person
  let salarySummary: string;
  let totalIncome = 0;
  if (salaries.length > 0) {
    totalIncome = salaries.reduce((s, r) => s + (r.amount || 0), 0);
    salarySummary = salaries.map((s) => `${s.person} R$ ${s.amount.toFixed(2).replace('.', ',')}`).join(' + ');
  } else {
    const latest = await db.query.salaries.findMany({
      where: eq(schema.salaries.userId, adminUser.id),
      orderBy: (s) => [s.createdAt],
      limit: 10,
    });
    const byPerson: Record<string, number> = {};
    for (const s of latest) {
      byPerson[s.person] = (byPerson[s.person] || 0) + (s.amount || 0);
    }
    salarySummary = Object.entries(byPerson).map(([p, a]) => `${p} R$ ${a.toFixed(2).replace('.', ',')}`).join(' + ');
    totalIncome = Object.values(byPerson).reduce((s, v) => s + v, 0);
  }

  // fetch bills for current month/year
  const bills = await db.query.bills.findMany({
    where: and(
      eq(schema.bills.userId, adminUser.id),
      eq(schema.bills.month, month),
      eq(schema.bills.year, year),
    ),
  });

  const fixed = bills.filter((b) => String(b.installment || '').toUpperCase() !== 'VARIAVEL');
  const variable = bills.filter((b) => String(b.installment || '').toUpperCase() === 'VARIAVEL');

  const fixedList = fixed.slice(0, 8).map((b) => `${b.name} R$ ${Number(b.amount || 0).toFixed(2).replace('.', ',')}`).join(', ');
  const variableList = variable.slice(0, 8).map((b) => `${b.name} R$ ${Number(b.amount || 0).toFixed(2).replace('.', ',')}`).join(', ');

  const investments = bills.filter((b) => (b.category || '').toLowerCase() === 'investimentos' || (b.name || '').toLowerCase().includes('invest'));
  const investSum = investments.reduce((s, b) => s + (b.amount || 0), 0);

  const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  const prompt = `Você é um consultor financeiro pessoal especializado em finanças domésticas brasileiras.\n\n` +
    `Contexto do usuário:\n` +
    `- Renda mensal: ${money(totalIncome)} (${salarySummary})\n` +
    `- Gastos fixos (exemplos): ${fixedList || '(nenhum registrado)'}\n` +
    `- Gastos variáveis (exemplos): ${variableList || '(nenhum registrado)'}\n` +
    `- Investimentos mensais identificados: ${money(investSum)}\n` +
    `- Localização: Brasil, Rio Grande do Sul\n\n` +
    `Tarefa: Gere um "Radar Financeiro Semanal" com exatamente as seções e regras abaixo (máximo 400 palavras):\n` +
    `1) INSIGHT DA SEMANA: oportunidade financeira acionável\n` +
    `2) ALERTA: risco ou ponto de atenção para a semana seguinte\n` +
    `3) COMPARATIVO DE MERCADO: compare UM gasto fixo com média de mercado (rotacionar a categoria semanalmente)\n` +
    `4) AÇÃO DA SEMANA: única ação concreta, executável em <30 minutos\n` +
    `5) PANORAMA DOS INVESTIMENTOS: como os ${money(investSum || 0) || 'R$ 0,00'}/mês se comportam em Tesouro Selic, CDB 100% CDI, LCI/LCA com base em Selic/CDI atual\n\n` +
    `Regras: usar R$ e contexto brasileiro, citar fontes reais (Tesouro Direto, Nubank, Inter, etc.), ser direto, máximo 400 palavras, finalizar com: "Próximo radar: sábado que vem 💚"`;

  // Enhance prompt with few-shot and strict output format
  const fewShot = `EXEMPLO BOM:\n\n💡 INSIGHT DA SEMANA:\nNegocie a taxa do seu plano de internet (redução possível de ~R$25/mês). Fonte: provedores locais.\n\n⚠️ ALERTA:\nFatura do cartão Itaú com variação alta; acompanhe compras grandes esta semana.\n\n📊 COMPARATIVO DE MERCADO:\nInternet: R$99,90 vs média nacional ~R$100-120 (fonte: Anatel).\n\n🎯 AÇÃO DA SEMANA:\nLigar para a operadora e pedir portabilidade ou desconto (phone + número do protocolo).\n\n📈 PANORAMA DOS INVESTIMENTOS:\nR$400/mês: Tesouro Selic (liquidez) vs CDB 100% CDI (pode render similar) — ver taxas no Tesouro Direto e corretoras.\n\nPróximo radar: sábado que vem 💚\n\nEXEMPLO RUIM:\nTexto vago, sem seções claras, sem números, várias recomendações genéricas.\n`;

  const strictInstruction = `INSTRUÇÕES IMPORTANTES:\n- Responda APENAS com as 5 seções abaixo, nessa ordem, usando exatamente os cabeçalhos indicados (sem texto extra):\n\n💡 INSIGHT DA SEMANA:\n[uma frase objetiva com ação e estimativa de impacto, citar fonte se possível]\n\n⚠️ ALERTA:\n[risco ou vencimento a acompanhar]\n\n📊 COMPARATIVO DE MERCADO:\n[comparar UM gasto fixo do usuário com média de mercado e citar fonte]\n\n🎯 AÇÃO DA SEMANA:\n[uma ação concreta, única, executável em <30 minutos]\n\n📈 PANORAMA DOS INVESTIMENTOS:\n[comparar Tesouro Selic, CDB 100% CDI, LCI/LCA com base nas taxas fornecidas abaixo]\n\n- Máximo 400 palavras no total.\n- Finalize com: Próximo radar: sábado que vem 💚`;

  // Try to fetch SELIC/CDI from env (optional) to provide concrete rates
  const selicRateEnv = process.env.SELIC_RATE ? Number(process.env.SELIC_RATE) : null;
  const cdiRateEnv = process.env.CDI_RATE ? Number(process.env.CDI_RATE) : null;

  const ratesNote = `Taxas atuais (se disponíveis): Selic ${selicRateEnv !== null ? selicRateEnv + '%' : 'não disponível'}, CDI ${cdiRateEnv !== null ? cdiRateEnv + '%' : 'não disponível'}.`;

  const fullPrompt = `${fewShot}\n\n${strictInstruction}\n\nContexto fornecido: ${prompt}\n\n${ratesNote}`;

  // Call Perplexity (or configured LLM) to get reference/snippets
  const result = await callPerplexity(fullPrompt);

  // Extract plain text from Perplexity response (concatenate snippets)
  let candidateText = '';
  if (result && typeof result !== 'string') {
    candidateText = result.results.map((r) => r.snippet).join('\n\n').trim();
  } else if (typeof result === 'string') {
    candidateText = result;
  }

  // Parser to extract sections
  function extractSections(text: string) {
    const sections: Record<string, string> = {};
    const markers = [
      '💡 INSIGHT DA SEMANA:',
      '⚠️ ALERTA:',
      '📊 COMPARATIVO DE MERCADO:',
      '🎯 AÇÃO DA SEMANA:',
      '📈 PANORAMA DOS INVESTIMENTOS:',
    ];
    const parts: string[] = [];
    // split by markers preserving markers
    let remaining = text;
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      const idx = remaining.indexOf(m);
      if (idx === -1) continue;
      remaining = remaining.slice(idx);
      // find next marker
      let nextIdx = Infinity;
      for (let j = i + 1; j < markers.length; j++) {
        const nj = remaining.indexOf(markers[j]);
        if (nj !== -1 && nj < nextIdx) nextIdx = nj;
      }
      if (nextIdx === Infinity) {
        parts.push(remaining);
        remaining = '';
      } else {
        parts.push(remaining.slice(0, nextIdx));
        remaining = remaining.slice(nextIdx);
      }
    }
    for (const p of parts) {
      for (const m of markers) {
        if (p.startsWith(m)) {
          sections[m] = p.replace(m, '').trim();
        }
      }
    }
    return sections;
  }

  let sections = extractSections(candidateText);

  // If not all sections found or candidate is too short, fallback to deterministic generator
  const allFound = ['💡 INSIGHT DA SEMANA:', '⚠️ ALERTA:', '📊 COMPARATIVO DE MERCADO:', '🎯 AÇÃO DA SEMANA:', '📈 PANORAMA DOS INVESTIMENTOS:'].every(k => !!sections[k]);

  function deterministicFallback() {
    const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
    const insight = `Reavalie o parcelamento do carro: simular redução de juros com refinanciamento pode reduzir parcela mensal em ~5-10% (ver bancos: Itaú/Inter).`;
    const alerta = `Acompanhe a fatura do Itaú esta semana; compras grandes podem empurrar o limite e gerar juros.`;
    const comparativo = fixedList ? `Internet (${fixedList.split(',')[0]}): ${fixedList ? fixedList.split(',')[0].split(' ').slice(-1)[0] : ''} versus média nacional (fonte: Anatel).` : 'Sem dados fixos suficientes para comparar.';
    const acao = `Ligar para a operadora de internet e solicitar revisão de pacote/valor (pode levar <30 minutos).`;
    const pano = `Investimentos mensais identificados ${money(investSum || 0)}. Comparar Tesouro Selic e CDB 100% CDI conforme taxas atuais (ver Tesouro Direto / corretoras).`;
    return `💡 INSIGHT DA SEMANA:\n${insight}\n\n⚠️ ALERTA:\n${alerta}\n\n📊 COMPARATIVO DE MERCADO:\n${comparativo}\n\n🎯 AÇÃO DA SEMANA:\n${acao}\n\n📈 PANORAMA DOS INVESTIMENTOS:\n${pano}\n\nPróximo radar: sábado que vem 💚`;
  }

  let finalText = '';
  if (!allFound || candidateText.length < 120) {
    // try a second attempt: ask Perplexity to reformat candidateText (if any)
    if (candidateText) {
      const reformPrompt = `${strictInstruction}\n\nReformate o texto abaixo respeitando o formato exato (apenas as 5 seções):\n\n${candidateText}`;
      const reform = await callPerplexity(reformPrompt);
      let reformText = '';
      if (reform && typeof reform !== 'string') reformText = reform.results.map(r => r.snippet).join('\n\n');
      else if (typeof reform === 'string') reformText = reform;
      const reformSections = extractSections(reformText);
      const reformAll = ['💡 INSIGHT DA SEMANA:', '⚠️ ALERTA:', '📊 COMPARATIVO DE MERCADO:', '🎯 AÇÃO DA SEMANA:', '📈 PANORAMA DOS INVESTIMENTOS:'].every(k => !!reformSections[k]);
      if (reformAll && reformText.length >= 120) finalText = reformText;
      else finalText = deterministicFallback();
    } else {
      finalText = deterministicFallback();
    }
  } else {
    finalText = candidateText;
  }

  try {
    await sendInsightsEmail(adminUser.email, finalText);
  } catch (err) {
    console.error("sendInsightsEmail error:", err);
    return NextResponse.json({ ok: false, error: "email_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, usedFallback: finalText === deterministicFallback() });
}
