# Plano v3 — Contas Cotidiano

Nov 7, 2026 · @Luan Silveira

A v3 troca 5 telas por 3 fluxos (Hoje, Mês, Patrimônio), torna a Revisão um ritual semanal obrigatório e alimenta tudo com dados reais via Pluggy. O ponto de partida é o repositório `personal-finance-up` (Next.js 14, Drizzle + Turso, Resend, Vercel Cron).

## O que o código mostra hoje

A poluição que você sente tem causa concreta: as duas telas principais concentram quase tudo num componente só.

| Arquivo | Linhas | O que empilha |
| --- | --- | --- |
| `BillsManager.tsx` (Contas) | 1.241 | navegação de mês, filtro de dono, ordenação, 4 cards de resumo, limites por categoria, salários, lista, faturas expansíveis, cartões alimentação, modal de migração |
| `DashboardView.tsx` | 638 | navegação de mês, alertas de risco, tendência anual, lembretes de futuras, grade anual, saúde do mês, semana à frente, comparação, composição, top categorias |
| `DebtsManager.tsx` | 995 | tela inteira para algo consultado poucas vezes |
| `CheckinManager.tsx` | 791 | perguntas semanal e mensal já prontas, mas sem gatilho |

Outros pontos que pesam no plano:

- **490 `style={{}}` e 656 cores hex soltas** espalhadas no `src`. O Tailwind tem `brand`/`surface`, mas quase nada usa. Trocar o visual sem antes criar tokens vira caça manual.
- **Revisão já existe por completo** (tabela `weekly_checkins`, perguntas geradas do contexto, e-mail `sendCheckinReminderEmail`). Falta só o gatilho e a leitura da evolução.
- **`sendInsightsEmail` existe e ninguém chama.** O "Radar Financeiro Semanal" ficou pela metade.
- **Investimentos só existem como categoria de conta** (`BILL_CATEGORIES`). Não há saldo, posição nem patrimônio.
- **Já há um cliente de IA genérico** (`lib/receipt/openai-compat.ts`) para leitura de cupom. Dá para reaproveitar o padrão.
- **Fonte atual:** Syne (títulos) + DM Sans (corpo), carregadas por `@import` no CSS, sem `next/font`.
- O `docs/plan-v2.md` previa Metas, Investimentos e Insights na Fase 3. Este plano reorganiza essa Fase 3.

## Princípios

Cada tela responde uma pergunta só; o resto vira detalhe sob demanda.

1. **Uma pergunta por tela.** Hoje: "preciso fazer algo agora?". Mês: "o mês fecha?". Patrimônio: "estou indo para onde quero?".
2. **Número primeiro, explicação embaixo.** Nenhum card sem frase que diga o que o número significa ("sobram R$ 820 até o dia 30", não só "R$ 820").
3. **Progressive disclosure.** Lista curta por padrão; filtros, ordenação e detalhe ficam atrás de um toque (drawer ou sheet no mobile).
4. **Ação a um toque.** Marcar pago, lançar gasto e abrir a Revisão sempre visíveis; o resto pode custar dois toques.
5. **Autêntico, não decorativo.** Da referência fica a hierarquia (número grande, rótulo pequeno, anéis de progresso, painel lateral de resumo). Sai o que é enfeite: o objeto 3D, neumorfismo com sombra dupla, números sem contexto ("Per minutes").
6. **Dado automático > dado digitado.** Quando o Pluggy trouxer a transação, a tela pede confirmação, não digitação.

## Nova navegação

O menu passa de 5 itens para 3 (Hoje, Mês, Patrimônio); a Revisão sai do menu e vira um ritual que se impõe.

&#91;embedded content: navegação atual → v3 · 5 telas para 3 + ritual\]

Futuras também aparecem em Hoje, na faixa dos próximos 7 dias. No mobile, os 3 itens viram uma barra inferior com um botão central "+" para lançar gasto.

## Hoje (ex-Dashboard) e Mês (ex-Contas)

O Dashboard deixa de ser um painel anual e vira a tela do dia; a visão anual sai dele e vai para Patrimônio.

**Hoje** mostra só cinco blocos, nesta ordem:

1. **Frase-resumo** no topo: "Faltam R$ 1.240 em contas até dia 30. Saldo projetado: R$ 820."
2. **Saldo por conta** (Pluggy) com a data da última sincronização.
3. **Próximos 7 dias:** contas a vencer e lembretes de Futuras, com botão de pagar.
4. **Três anéis** (estilo da referência, mas com significado): orçamento do mês usado, contas pagas, meta de aporte.
5. **Um insight da semana** (o melhor, não uma lista) com link para a Revisão.

Saem do Dashboard: grade anual, tendência anual, comparação mês a mês e composição por recorrência (vão para Patrimônio > Evolução). Alertas de risco viram insights (seção de insights).

**Mês** (ex-Contas) fica com três abas no lugar da página única:

| Aba | Conteúdo | Sai de onde |
| --- | --- | --- |
| Contas | lista enxuta: nome, vencimento, valor, check de pago; fatura expande transações | lista atual |
| Categorias | limites por categoria com barra; toque abre as transações | `CategoryBudgets` |
| Entradas | salários e receitas; com Pluggy, créditos detectados para confirmar | modal de salários |

Filtro de dono (minha/dela/conjunta), ordenação e migração de mês vão para um menu "⋯" no cabeçalho. Os 4 cards de resumo viram uma linha só (Entradas · Saídas · Saldo). Cartões alimentação passam a ser uma conta do tipo `MEAL` dentro de Patrimônio > Contas, não um bloco no rodapé.

Na prática isso quebra o `BillsManager.tsx` em `MonthHeader`, `BillsTab`, `CategoriesTab`, `IncomeTab` e um hook `useMonthData`, o que já resolve boa parte da poluição antes de qualquer mudança visual.

## Futuras e Dívidas: de tela para presença

São importantes e pouco abertas porque exigem lembrar de ir até elas; a solução é trazê-las para onde você já está, em vez de criar mais um destino.

**Futuras**

- Somem do menu. Viram um item "Previsto" dentro do Mês: lembretes aparecem na lista do mês em que vencem, com estilo pontilhado, até virarem conta real (o fluxo `future-bills/accept` já existe).
- Em Hoje, entram em "Próximos 7 dias" junto com as contas.
- Criação rápida: no formulário de conta, um switch "ainda não tenho o valor exato" cria uma Futura.
- Na Revisão semanal, uma pergunta fixa: "Algo que vai cair nas próximas semanas e não está aqui?".

**Dívidas**

- Vão para Patrimônio, como passivo. Patrimônio líquido = contas + investimentos − dívidas, então elas passam a ter um número que importa.
- Cada dívida ganha uma linha de progresso (pago / total) e a projeção "quitada em mês/ano no ritmo atual", calculada pelos `debt_bill_links`.
- Na Revisão mensal, a tela de dívidas aparece como um passo obrigatório: confirmar saldo devedor de cada uma (isso alimenta o `history_debts` sem esforço extra).
- Com Pluggy, empréstimos e financiamentos vêm do Open Finance e a dívida se atualiza sozinha.

Resultado: o menu cai de 5 para 3 itens fixos, mais a Revisão como ação.

## Revisão obrigatória

A partir de segunda-feira 00:00, o primeiro acesso da semana abre um modal de Revisão que não fecha até ser concluído; leva de 3 a 5 minutos porque chega pré-preenchido.

**Gatilho**

- Checagem no `layout` das rotas autenticadas (server component), não no middleware: ele roda no edge e não deve consultar o banco a cada request.
- Regra: existe `weekly_checkins` com `type = 'weekly'` para a semana ISO anterior? Se não, renderiza `<RevisaoGate>` por cima da página, com fundo desfocado.
- Use `getISOWeek` + `getISOWeekYear` do `date-fns` (já é dependência). Hoje o schema grava só `year`; na virada de ano a semana 1 de 2027 começa em 28/12/2026 e isso quebra a busca sem o ano ISO.
- Mensal: no primeiro acesso a partir do dia 1, o modal vira o fechamento do mês anterior (já existe o modo `monthly` no `CheckinManager`).
- Uma única válvula de escape: "adiar 2 horas", uma vez por semana. Sem ela, o modal vira um obstáculo para pagar uma conta urgente e você começa a evitar abrir o app.

**O formulário (passos curtos, um por tela)**

1. Conferir: contas pagas e não pagas da semana, transações do Pluggy sem categoria (confirmar em lote).
2. Dívidas: confirmar saldo devedor de cada uma (só no mensal).
3. Futuras: "algo novo vindo aí?".
4. Termômetro: três notas de 1 a 5 (controle dos gastos, preocupação com dívidas, confiança no fim do mês).
5. Uma decisão para a próxima semana, em texto livre.

**Evolução do pensamento**

O ganho real vem de guardar, junto com as respostas, um retrato dos números daquele momento. Proposta para o JSON `data`:

```json
{
  "snapshot": { "saldo": 0, "gastoSemana": 0, "dividaTotal": 0, "patrimonio": 0, "porCategoria": {} },
  "scores": { "controle": 4, "preocupacaoDividas": 2, "confianca": 3 },
  "decision": "...",
  "previousDecisionKept": true,
  "answers": []
}
```

Com isso, a tela de Revisão (fora do modal) ganha uma aba **Evolução**: linha do tempo com as três notas por semana sobre o patrimônio e a dívida total, mais a lista de decisões e se foram cumpridas. Assim dá para ver, por exemplo, se a preocupação com dívidas caiu de fato quando o saldo devedor caiu.

## Investimentos e Patrimônio

Uma nova tela Patrimônio junta contas, investimentos e dívidas num número só, e é ali que investimentos se vinculam às contas.

**Modelo de dados (3 tabelas novas)**

| Tabela | Campos principais | Origem |
| --- | --- | --- |
| `accounts` | nome, tipo (`checking`, `savings`, `credit`, `meal`, `investment`), instituição, saldo, `pluggy_account_id`, `last_sync_at` | Pluggy ou manual |
| `investments` | `account_id`, nome, tipo (CDB, Tesouro, LCI/LCA, fundo, ação, previdência), valor aplicado, saldo, vencimento, `pluggy_investment_id` | Pluggy ou manual |
| `net_worth_snapshots` | data, total contas, total investimentos, total dívidas, patrimônio líquido | gerada pelo cron e pela Revisão |

**Vínculo com Contas**

- Uma conta com categoria `investimentos` (o aporte mensal) ganha um campo opcional `investment_id`. Ao marcar como paga, o valor soma no aplicado daquele investimento.
- Assim o aporte deixa de ser só "gasto" e passa a aparecer como transferência para o patrimônio. No resumo do Mês, aportes saem de Saídas e entram numa linha própria ("Investido: R$ X").

**Tela Patrimônio (abas)**

- **Visão:** patrimônio líquido no topo, composição (contas · investimentos · dívidas) e variação no mês.
- **Contas:** saldos por conta, inclusive cartões alimentação.
- **Investimentos:** posições agrupadas por tipo, com rentabilidade aplicada vs. saldo.
- **Dívidas:** o que saiu da antiga tela Dívidas.
- **Evolução:** a visão anual que sai do Dashboard (gráfico de patrimônio por mês, entradas vs. saídas).

## Pluggy: saldo e saídas automáticos

O caminho viável para uso pessoal é o MeuPluggy: você conecta seus bancos por Open Finance no app gratuito deles, e o seu sistema lê esses dados com uma aplicação de desenvolvimento no portal da Pluggy.

**Como funciona** ([meu-pluggy no GitHub](https://github.com/pluggyai/meu-pluggy))

- Você cria conta em meu.pluggy.ai e conecta cada banco pelo fluxo de Open Finance.
- No portal de desenvolvedor (dashboard.pluggy.ai), adiciona o conector MeuPluggy e cria uma aplicação de desenvolvimento, que gera `client_id` e `client_secret`.
- O app autoriza o acesso via OAuth do MeuPluggy, uma vez por banco (não por conta). A conexão é atualizada diariamente pelo próprio MeuPluggy.
- O portal começa com 15 dias de teste; a conexão do Itaú via Open Finance pelo MeuPluggy segue sem custo para uso pessoal.
- Dados confirmados no README: conta corrente, poupança, cartão, transações e empréstimos. Investimentos têm conector próprio na API, mas o README não confirma que vêm pelo MeuPluggy; testar na fase de prova.

**Mudanças recentes que afetam o desenho** ([changelog jul/2026](https://v2.docs.pluggy.ai/en/changelog/2026.07))

- Conectores diretos para pessoa física estão sendo descontinuados (Bradesco PF e Itaú já saíram, XP na sequência). Use só Open Finance.
- Contas criadas a partir de jun/2026 usam o endpoint de transações paginado por cursor; implemente direto nele.
- Cartões ganharam `billClosingDate` e `billForecastDate`, úteis para prever a fatura no Mês.

**Arquitetura no projeto**

- `lib/pluggy/client.ts` só no servidor; segredos em env da Vercel, nunca no cliente. No banco, guarde só o `itemId`.
- Sync diário reaproveitando o cron `/api/cron/notifications` (evita estourar o limite de crons do plano Hobby) + botão "sincronizar agora" em Patrimônio.
- Tabela `bank_transactions` com `pluggy_id` único (idempotência), conta, data, valor, descrição, categoria e `bill_id` opcional.
- **Conciliação:** ao chegar uma saída, procura conta do mês com valor igual (±1%) e vencimento a ±5 dias. Achou: sugere "marcar como paga" em Hoje. Não achou: vai para "a categorizar" na Revisão.
- Faturas de cartão: transações do cartão alimentam as `card_transactions` da fatura correspondente, sem digitação.
- Contas manuais continuam valendo; o Pluggy complementa, não substitui. Se a conexão cair, o app segue funcionando como hoje.

**Contas da esposa: entrada manual ou por arquivo**

O Pluggy fica só com as suas contas. As dela entram por dois caminhos, ambos com `ownership = 'hers'` gravado automaticamente:

- **Formulário rápido:** o formulário de conta e de transação atual, com "dela" pré-selecionado quando aberto a partir da conta dela em Patrimônio.
- **Importação de arquivo:** tela "Importar extrato" que aceita OFX e CSV. O fluxo é ler o arquivo, mostrar uma prévia com as categorias sugeridas, remover duplicadas e salvar em `bank_transactions` com `source = 'import'`.
- **Deduplicação:** OFX traz `FITID`, que vira a chave única. CSV não tem identificador, então a chave é um hash de data + valor + descrição.
- A mesma conciliação do Pluggy roda sobre o que foi importado, então contas dela também podem ser marcadas como pagas sozinhas.
- Na Revisão semanal, um lembrete aparece quando a última importação dela tiver mais de 7 dias.

## Insights com IA e e-mail semanal

Insight assertivo nasce do código, não do modelo: o sistema calcula os fatos, e o Gemini só escreve a frase e prioriza. Isso evita número inventado.

**Camada 1: fatos calculados (determinístico)** — evolução do `lib/risk`:

| Insight | Regra | Exemplo de saída |
| --- | --- | --- |
| Ritmo da categoria | gasto até hoje ÷ dia do mês × dias do mês vs. limite | "Alimentação vai fechar em R$ 1.380, 15% acima do limite" |
| Assinatura nova | transação recorrente que não existia há 60 dias | "Nova cobrança mensal de R$ 39,90 desde outubro" |
| Parcelas comprometidas | soma das parcelas dos próximos 6 meses | "R$ 2.100/mês já comprometidos até abril" |
| Dívida | projeção de quitação no ritmo atual | "No ritmo atual, quita em agosto/2027" |
| Decisão da Revisão | decisão da semana anterior vs. dados | "Você decidiu não usar o cartão para lazer; foram 2 compras" |
| Fôlego | saldo projetado ÷ gasto médio diário | "O saldo cobre 18 dias de gastos normais" |

Os alertas de risco atuais (`installments_growth`, `fixed_growth`, `card_recurrence`) viram três linhas dessa tabela.

**Camada 2: Gemini como redator**

- Recebe só o JSON de fatos agregados (sem descrição de transação, sem nome de banco) e devolve os 3 insights mais relevantes, cada um com número, causa e uma ação concreta.
- Reaproveita o padrão do `lib/receipt/openai-compat.ts`: o Gemini expõe endpoint compatível com OpenAI, então é trocar URL, chave e modelo por env.
- A chave vem do Google AI Studio. Assinatura do app Gemini não inclui a API. Desde abril/2026 o tier gratuito da API cobre só os modelos Flash ([fonte](https://agentdeals.dev/gemini-api-pricing-changes)), o que basta para um e-mail por semana. Antes de enviar dados financeiros, confira os termos de uso de dados do tier gratuito.
- Fallback: sem resposta da IA, o e-mail sai com as frases-modelo da camada 1.

**E-mail "Radar da semana"** (ligar o `sendInsightsEmail`, que já existe sem uso)

- Segunda de manhã, no cron `/api/cron/risk-alerts` que já roda às segundas.
- Estrutura: a frase-resumo da semana, os 3 insights, e um botão "Fazer a Revisão" que abre o modal direto.
- Tabela `insights` guardando cada insight gerado com botões útil / não útil. Com algumas semanas de votos dá para cortar tipos que você ignora.

## Visual e tipografia

Recomendo Manrope como fonte única, carregada por `next/font`, com números tabulares em todo valor monetário.

**Fonte**

| Opção | Por que | Contra |
| --- | --- | --- |
| **Manrope** (recomendada) | geométrica sem ser Poppins, números largos e legíveis, bom peso 800 para os valores grandes da referência | menos personalidade nos títulos |
| Plus Jakarta Sans | mais calorosa, títulos bonitos | já aparece em muito template de SaaS |
| Figtree | muito limpa em telas pequenas | parecida demais com Inter |

- Uma família só (some o Syne + DM Sans): títulos em 700, valores em 800, corpo em 400/500.
- `font-variant-numeric: tabular-nums` em valores, para colunas de R$ alinharem.
- Trocar o `@import` do `globals.css` por `next/font/google`: carrega do próprio domínio, sem salto de layout.

**O que levar da referência, com significado**

- **Superfícies cinza-grafite neutras** no lugar do verde-escuro atual. O verde fica só como acento (positivo, pago, dentro do limite), e por isso volta a chamar atenção.
- **Número grande + rótulo pequeno + frase de contexto** em todo card.
- **Anéis de progresso** só onde há um limite real (orçamento, meta, parcelas pagas). Cor por status: verde até 80%, âmbar até 100%, vermelho acima.
- **Painel lateral de resumo** no desktop (≥ 1280 px) com saldo, patrimônio e próxima conta; no mobile ele vira o topo de Hoje.
- Profundidade com uma sombra suave e uma borda de 1 px mais clara no topo do card. Sem neumorfismo de sombra dupla: ele derruba o contraste do texto.

**Pré-requisito técnico**

Antes de qualquer tela nova: definir tokens em CSS (`--surface`, `--surface-raised`, `--text`, `--text-muted`, `--accent`, `--positive`, `--warning`, `--negative`), mapear no `tailwind.config.ts` e substituir as 656 cores hex. Um script com regex resolve a maior parte; o resto é manual. Isso também deixa um tema claro a um passo, se você quiser depois.

## Fases

Estrutura vem antes de dados: o Pluggy só entra quando a tela nova já sabe onde mostrar cada transação.

&#91;embedded content: fases da v3 · 4 fases, 3 critérios de passagem\]

Os losangos são os critérios para avançar. O da Fase 1 testa o comportamento, não o código: se em quatro semanas você não fez a Revisão sem adiar, o formulário está pesado demais e precisa encolher antes de ganhar insights por cima.

## Decisões tomadas

| Questão | Decisão | Efeito no plano |
| --- | --- | --- |
| Quem faz a Revisão | só você (único usuário) | gatilho por usuário logado, sem lógica de casal |
| Bloqueio | válvula "adiar 2 horas", uma vez por semana | mantém o desenho da seção Revisão |
| Pluggy | MeuPluggy via Open Finance do Itaú, sem custo, só para as suas contas; as da esposa por formulário ou importação OFX/CSV | primeiro banco da prova na Fase 2; o conector direto do Itaú PF já foi descontinuado, então é Open Finance mesmo |
| Investimentos | via Pluggy se o conector trouxer; senão manual | testar na prova da Fase 2; manual com atualização na Revisão mensal como fallback |
| Gemini | tier gratuito | enviar só fatos agregados, sem descrição de transação nem nome de banco |
| Fonte | Manrope | entra na Fase 0 |
