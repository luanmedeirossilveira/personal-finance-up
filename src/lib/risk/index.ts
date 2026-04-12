// src/lib/risk/index.ts
// Motor de detecção de riscos — compartilhado entre cron e API
// Compara mês atual com mês anterior e gera alertas estruturados.

import type { Bill, RiskAlertType, RiskSeverity } from "@/lib/db/schema";

export interface DetectedAlert {
  type: RiskAlertType;
  severity: RiskSeverity;
  title: string;
  message: string;
}

const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isInstallment(bill: Bill): boolean {
  const inst = (bill.installment || "").toUpperCase().trim();
  // Parcelamentos: formatos "3/12", "1/6" etc. Exclui SEMPRE, ÚNICO, VARIAVEL
  return /^\d+\/\d+$/.test(inst);
}

function isFixed(bill: Bill): boolean {
  const inst = (bill.installment || "").toUpperCase().trim();
  return inst === "SEMPRE";
}

function isCardBill(bill: Bill): boolean {
  return bill.type === "CARD";
}

// ─── Detecção principal ───────────────────────────────────────────────────────

export function detectRisks(
  currentBills: Bill[],
  previousBills: Bill[],
): DetectedAlert[] {
  const alerts: DetectedAlert[] = [];

  // ── 1. Crescimento de parcelamentos ──────────────────────────────────────
  const currInstallmentTotal = currentBills
    .filter(isInstallment)
    .reduce((s, b) => s + b.amount, 0);
  const prevInstallmentTotal = previousBills
    .filter(isInstallment)
    .reduce((s, b) => s + b.amount, 0);

  if (prevInstallmentTotal > 0) {
    const delta = currInstallmentTotal - prevInstallmentTotal;
    const pct = (delta / prevInstallmentTotal) * 100;

    if (pct >= 30) {
      alerts.push({
        type: "installments_growth",
        severity: "danger",
        title: "Parcelamentos cresceram muito",
        message: `Total de parcelamentos subiu ${Math.round(pct)}% em relação ao mês anterior: de ${BRL(prevInstallmentTotal)} para ${BRL(currInstallmentTotal)} (+${BRL(delta)}). Novos parcelamentos reduzem sua folga nos próximos meses.`,
      });
    } else if (pct >= 15) {
      alerts.push({
        type: "installments_growth",
        severity: "warning",
        title: "Parcelamentos em alta",
        message: `Total de parcelamentos cresceu ${Math.round(pct)}% vs mês anterior: de ${BRL(prevInstallmentTotal)} para ${BRL(currInstallmentTotal)} (+${BRL(delta)}). Fique de olho no comprometimento futuro.`,
      });
    }
  } else if (currInstallmentTotal > 0 && prevInstallmentTotal === 0) {
    // Primeiro mês com parcelamentos
    alerts.push({
      type: "installments_growth",
      severity: "warning",
      title: "Novos parcelamentos registrados",
      message: `${BRL(currInstallmentTotal)} em parcelamentos este mês — nenhum havia sido registrado no mês anterior. Monitore o impacto nos próximos meses.`,
    });
  }

  // ── 2. Crescimento de despesas fixas ─────────────────────────────────────
  const currFixedTotal = currentBills
    .filter(isFixed)
    .reduce((s, b) => s + b.amount, 0);
  const prevFixedTotal = previousBills
    .filter(isFixed)
    .reduce((s, b) => s + b.amount, 0);

  if (prevFixedTotal > 0) {
    const delta = currFixedTotal - prevFixedTotal;
    const pct = (delta / prevFixedTotal) * 100;

    if (pct >= 20) {
      alerts.push({
        type: "fixed_growth",
        severity: "danger",
        title: "Despesas fixas dispararam",
        message: `Gastos fixos cresceram ${Math.round(pct)}% vs mês anterior: de ${BRL(prevFixedTotal)} para ${BRL(currFixedTotal)} (+${BRL(delta)}). Despesas fixas altas são as mais difíceis de cortar em momentos de aperto.`,
      });
    } else if (pct >= 10) {
      alerts.push({
        type: "fixed_growth",
        severity: "warning",
        title: "Despesas fixas crescendo",
        message: `Gastos fixos subiram ${Math.round(pct)}% vs mês anterior: de ${BRL(prevFixedTotal)} para ${BRL(currFixedTotal)} (+${BRL(delta)}). Revise se novos gastos fixos foram necessários.`,
      });
    }
  }

  // ── 3. Uso recorrente de cartão para fechar o mês ────────────────────────
  const currCardTotal = currentBills
    .filter(isCardBill)
    .reduce((s, b) => s + b.amount, 0);
  const prevCardTotal = previousBills
    .filter(isCardBill)
    .reduce((s, b) => s + b.amount, 0);

  const currCardCount = currentBills.filter(isCardBill).length;
  const prevCardCount = previousBills.filter(isCardBill).length;

  // Alerta quando há faturas de cartão em 2+ meses seguidos E o total cresceu
  if (currCardCount > 0 && prevCardCount > 0) {
    const delta = currCardTotal - prevCardTotal;
    const pct = prevCardTotal > 0 ? (delta / prevCardTotal) * 100 : 0;

    if (pct >= 20) {
      alerts.push({
        type: "card_recurrence",
        severity: "danger",
        title: "Fatura do cartão crescendo mês a mês",
        message: `Faturas de cartão somam ${BRL(currCardTotal)} este mês (+${Math.round(pct)}% vs mês anterior). Uso crescente do cartão pode indicar que as despesas estão ultrapassando a renda corrente.`,
      });
    } else if (currCardCount >= 2) {
      // Múltiplos cartões ativos simultaneamente
      alerts.push({
        type: "card_recurrence",
        severity: "warning",
        title: "Múltiplos cartões em uso",
        message: `${currCardCount} faturas de cartão registradas este mês (total: ${BRL(currCardTotal)}). Uso recorrente de cartão como principal forma de pagamento pode dificultar o controle do fluxo real.`,
      });
    }
  } else if (currCardCount > 0 && prevCardCount === 0 && currCardTotal > 0) {
    // Começou a usar cartão este mês
    // Sem alerta — é comportamento normal
  }

  return alerts;
}