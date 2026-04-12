# plan.md — Personal Finance UP v2

> Documento de planejamento para o agente de desenvolvimento do app **Personal Finance UP**.
> Baseado na v1 pública ([github.com/luanmedeirossilveira/personal-finance-up](https://github.com/luanmedeirossilveira/personal-finance-up)) e na pesquisa do **Método 3C**.

---

## Contexto do projeto

O app é um sistema de controle financeiro **pessoal para casal** (Luan + esposa), atualmente na v1 funcional. A v2 deixa de ser apenas um "lançador de contas" e passa a ser um **sistema de acompanhamento da vida financeira do casal**, estruturado pelo Método 3C.

### Stack atual (manter)
- **Frontend/Backend**: Next.js 14 (App Router, TypeScript)
- **Banco de dados**: Turso (SQLite distribuído)
- **ORM**: Drizzle ORM
- **Email**: Resend
- **Deploy**: Vercel (cron diário às 8h)
- **UI**: Tailwind CSS + Recharts

### Telas existentes na v1
| Tela | Função atual |
|---|---|
| Dashboard | Insights iniciais + redirecionamento |
| Contas | Contas mensais (fixas, variáveis, parceladas) |
| Futuras | Planejamento de contas futuras |
| Dívidas | Valores de dívidas atrasadas |

---

## Direção de produto — Método 3C

O Método 3C reorganiza a experiência respondendo três perguntas centrais do casal:

| # | Pergunta | Épico |
|---|---|---|
| C1 | Como estamos nos comportando? | **Comportamentos** |
| C2 | O que já entendemos sobre o nosso dinheiro? | **Conhecimentos** |
| C3 | Quais conceitos financeiros afetam nossas decisões? | **Conceitos** |

Além dos 3Cs, um quarto pilar estrutura o uso a dois:

| Pilar | Foco |
|---|---|
| **Governança do casal** | Papéis, visões individual/conjunta e acordos compartilhados |

---

## Épicos e backlog

### Épico 1 — Comportamentos *(prioridade máxima)*
> Mais aderente ao momento de vida e à lógica do 3C. Começar por aqui.

- [ ] **Check-in semanal do casal** — resumo de 5 a 10 min: entradas, saídas, contas a vencer e alertas
- [ ] **Fechamento mensal guiado** — telas com "o que saiu do plano", "o que repetiu", "o que melhorar"
- [ ] **Limites por categoria** — mercado, lazer, delivery, transporte, assinaturas — com barra de progresso visual
- [ ] **Alertas de comportamento de risco** — aumento de parcelamentos, uso recorrente de cartão para fechar o mês, crescimento de fixas
- [ ] **Registro de decisões do casal** — ex: "reduzir delivery", "quitar cartão X", "formar reserva de 3 meses"
- [ ] **Score de consistência mensal** — focado em hábito e disciplina, não em patrimônio

---

### Épico 2 — Conhecimentos
> Ensinar sem virar curso — microaprendizado no contexto do uso.

- [ ] **Cards explicativos no dashboard** — "o que é custo fixo", "despesa eventual", "por que parcelamento reduz folga futura"
- [ ] **Tooltips/drawers nos indicadores** — saldo livre, comprometimento futuro, reserva, dívida cara, patrimônio líquido
- [ ] **Explicação contextual em Dívidas** — juros, rolagem, amortização, prioridade de quitação
- [ ] **Explicação contextual em Metas** — diferença entre reserva de emergência, objetivo de curto prazo e investimento de longo prazo
- [ ] **Feed "Aprendizados do mês"** — gerado dos dados reais do casal (ex: "vocês aumentaram gastos recorrentes em X categorias")

---

### Épico 3 — Conceitos
> Teoria financeira traduzida em visualização prática.

- [ ] **Simulador de juros compostos** — investimentos e dívidas, comparando "pagar mínimo" vs "antecipar quitação"
- [ ] **Simulador de parcelamento** — custo total, impacto no fluxo futuro e comprometimento de renda mensal
- [ ] **Custo do crédito por cartão/dívida/financiamento** — para priorização de quitação
- [ ] **Tela de patrimônio líquido** — consolida saldo em contas + investimentos − dívidas
- [ ] **Projeção de cenários** — conservador, realista e agressivo para metas e quitação
- [ ] **Indicador "dinheiro já comprometido"** — liga tela de Futuras com cartões, parcelas e débitos programados

---

### Épico 4 — Governança do casal *(diferencial real do produto)*
> O que torna o app único para uso pessoal a dois.

- [ ] **Visão "minha", "da esposa" e "conjunta"** por conta/categoria
- [ ] **Categorias com responsabilidade** — quem lançou, quem paga, quem acompanha
- [ ] **Acordos financeiros compartilhados** — teto de gasto livre individual, valor mínimo de poupança conjunta
- [ ] **Metas com contribuição proporcional ou fixa por pessoa**
- [ ] **Linha do tempo de decisões relevantes** — log de por que algo foi combinado
- [ ] **Modo conversa/revisão** — checklist de fechamento semanal e mensal a dois

---

## Evolução das telas existentes

| Tela | Estado v1 | Evolução v2 |
|---|---|---|
| **Dashboard** | Insights básicos + redirecionamento | Central do Método 3C: saúde do mês, alertas, compromissos futuros, progresso de metas, check-in do casal |
| **Contas** | CRUD de contas mensais | Manter base operacional + classificação `pessoal / conjunta`, `obrigatória / opcional`, `fixa / variável` |
| **Futuras** | Planejamento simples | Hub de compromisso futuro: parcelas, recorrentes, metas programadas e previsões |
| **Dívidas** | Lista de dívidas atrasadas | Centro de estratégia de quitação: priorização por custo e impacto |

---

## Novas telas a criar

| Tela | Objetivo |
|---|---|
| **Metas** | Objetivos financeiros do casal com prazo, valor-alvo e progresso |
| **Investimentos** | Reserva, patrimônio e alocação simples (não trading) |
| **Revisão** | Semanal e mensal — conecta o Método 3C ao uso real |
| **Insights** | Conhecimento + conceitos explicados a partir dos dados do casal |

---

## Regras de negócio

1. Toda despesa deve poder ser marcada como **pessoal (minha)**, **pessoal (esposa)** ou **conjunta**.
2. Todo parcelamento deve gerar **impacto futuro visível** no dashboard.
3. Toda dívida deve ter **prioridade calculada** por custo e urgência.
4. Toda meta deve ter **prazo, contribuição e origem do dinheiro**.
5. Todo fechamento mensal deve gerar **pelo menos um aprendizado e uma decisão** do casal.
6. O dashboard deve sempre responder: **quanto entrou / saiu / está comprometido / sobrou de verdade**.
7. Alertas de email devem ser enviados para **múltiplos destinatários** (minha conta + conta da esposa).

---

## Diretrizes de UX

O Método 3C funciona melhor quando o usuário **sente que está evoluindo**, não apenas registrando dados.

- **Dashboard em linguagem humana** — status do mês sem jargão financeiro pesado
- **Alertas acionáveis** — não só métricas; o cron atual (email diário) deve evoluir para suportar múltiplos emails
- **Ritual semanal e mensal** — telas dedicadas de check-in que criam o hábito
- **Progressão visual do casal** — barras, scores, marcos atingidos
- **Explicações curtas no momento da decisão** — tooltips e drawers contextuais
- **Pouca "financeirização estética"** — clareza prática acima de tudo

---

## Resultado esperado

| Dimensão | Meta |
|---|---|
| **Saúde financeira** | Organização e acumulação incremental de bens |
| **Relacionamento** | Redução de atrito na comunicação sobre dinheiro |
| **Linguagem comum** | Casal compartilha o mesmo framework de decisões (gastos, dívidas, reserva, investimento) |
| **Status atual** | EM ANDAMENTO — base operacional v1 concluída |

---

## Ordem de implementação sugerida

```
Fase 1 (Comportamentos)
  └── A. Classificação pessoal/conjunta nas Contas
  └── B. Limites por categoria + barra de progresso
  └── C. Alertas de comportamento de risco
  └── D. Check-in semanal (tela Revisão v1)
  └── E. Multi-email no cron Resend

Fase 2 (Conhecimentos + Governança)
  └── A. Cards explicativos no Dashboard
  └── B. Feed "Aprendizados do mês"
  └── C. Visão individual vs conjunta
  └── D. Registro de decisões do casal
  └── E. Fechamento mensal guiado

Fase 3 (Conceitos + Novas telas)
  └── A. Tela Metas
  └── B. Tela Investimentos
  └── C. Simuladores (parcelamento, juros compostos)
  └── D. Patrimônio líquido + cenários
  └── E. Tela Insights completa
```

---

*Gerado em abril/2026 — Personal Finance UP v2 — Método 3C*
