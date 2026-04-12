import { Resend } from "resend";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DetectedAlert } from "@/lib/risk";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || "contas@seudominio.com";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1a16;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:48px auto;padding:40px;background:#162019;border-radius:16px;border:1px solid #2a3d31;">
    <div style="margin-bottom:24px;">
      <span style="font-size:22px;font-weight:800;color:#5ab28d;">Contas</span>
      <span style="font-size:22px;font-weight:300;color:#8dcdb0;"> Cotidiano</span>
    </div>
    ${content}
    <div style="margin-top:32px;border-top:1px solid #2a3d31;padding-top:16px;">
      <a href="${process.env.NEXTAUTH_URL}/dashboard"
         style="display:inline-block;background:#389671;color:#fff;text-decoration:none;
                padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">
        Abrir dashboard →
      </a>
    </div>
  </div>
</body>
</html>`;
}

// ─── Existing functions (unchanged) ──────────────────────────────────────────

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const url = `${process.env.NEXTAUTH_URL}/api/auth/verify?token=${token}`;
  await resend.emails.send({
    from: FROM, to: email,
    subject: "🔐 Verificar acesso — Contas Cotidiano",
    html: emailWrapper(`
      <h1 style="color:#f0f9f4;font-size:20px;font-weight:600;margin:0 0 12px;">Verificar seu acesso</h1>
      <p style="color:#8dcdb0;font-size:15px;line-height:1.6;margin:0 0 32px;">
        Clique no botão abaixo para confirmar seu acesso. Este link expira em <strong style="color:#f0f9f4;">24 horas</strong>.
      </p>
      <a href="${url}" style="display:inline-block;background:#389671;color:#fff;text-decoration:none;
         padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
        Verificar e entrar
      </a>
      <p style="color:#4a6b58;font-size:12px;margin:32px 0 0;">Se você não solicitou este acesso, ignore este email.</p>
    `),
  });
}

export async function sendMonthlyOverview(
  email: string,
  data: {
    month: string; year: number; totalBills: number; paidBills: number;
    pendingBills: number; totalIncome: number; balance: number;
    upcomingDue: Array<{ name: string; amount: number; dueDay: number }>;
  }
): Promise<void> {
  const balanceColor = data.balance >= 0 ? "#5ab28d" : "#ef4444";
  const upcomingList = data.upcomingDue.slice(0, 5).map((b) =>
    `<tr>
      <td style="padding:8px 0;color:#8dcdb0;font-size:14px;">${b.name}</td>
      <td style="padding:8px 0;color:#f0f9f4;font-size:14px;text-align:right;">R$ ${b.amount.toFixed(2).replace(".", ",")}</td>
      <td style="padding:8px 0;color:#4a6b58;font-size:14px;text-align:right;">dia ${b.dueDay}</td>
    </tr>`
  ).join("");

  await resend.emails.send({
    from: FROM, to: email,
    subject: `📊 Panorama de ${data.month} ${data.year} — Contas Cotidiano`,
    html: emailWrapper(`
      <div style="color:#4a6b58;font-size:13px;margin-bottom:20px;">Panorama de ${data.month} ${data.year}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px;">
        <div style="background:#1c2b22;border-radius:10px;padding:16px;">
          <div style="color:#4a6b58;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Total contas</div>
          <div style="color:#f0f9f4;font-size:22px;font-weight:700;">R$ ${data.totalBills.toFixed(2).replace(".", ",")}</div>
        </div>
        <div style="background:#1c2b22;border-radius:10px;padding:16px;">
          <div style="color:#4a6b58;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Renda total</div>
          <div style="color:#f0f9f4;font-size:22px;font-weight:700;">R$ ${data.totalIncome.toFixed(2).replace(".", ",")}</div>
        </div>
        <div style="background:#1c2b22;border-radius:10px;padding:16px;">
          <div style="color:#4a6b58;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Já pago</div>
          <div style="color:#5ab28d;font-size:22px;font-weight:700;">R$ ${data.paidBills.toFixed(2).replace(".", ",")}</div>
        </div>
        <div style="background:#1c2b22;border-radius:10px;padding:16px;">
          <div style="color:#4a6b58;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Saldo</div>
          <div style="color:${balanceColor};font-size:22px;font-weight:700;">R$ ${data.balance.toFixed(2).replace(".", ",")}</div>
        </div>
      </div>
      ${data.upcomingDue.length > 0 ? `
        <h3 style="color:#8dcdb0;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Próximos vencimentos</h3>
        <table style="width:100%;border-collapse:collapse;">${upcomingList}</table>
      ` : ""}
    `),
  });
}

export async function sendDueSoonAlert(
  email: string,
  bills: Array<{ name: string; amount: number; dueDay: number; daysLeft: number }>
): Promise<void> {
  const list = bills.map((i) =>
    `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #2a3d31;">
      <div>
        <div style="color:#f0f9f4;font-size:14px;font-weight:500;">${i.name}</div>
        <div style="color:#4a6b58;font-size:12px;">Vence em ${i.daysLeft === 0 ? "hoje" : `${i.daysLeft} dia${i.daysLeft > 1 ? "s" : ""}`}</div>
      </div>
      <div style="color:#f59e0b;font-size:15px;font-weight:600;">R$ ${i.amount.toFixed(2).replace(".", ",")}</div>
    </div>`
  ).join("");

  await resend.emails.send({
    from: FROM, to: email,
    subject: `⚠️ ${bills.length} conta${bills.length > 1 ? "s vencem" : " vence"} em breve — Contas Cotidiano`,
    html: emailWrapper(`
      <div style="background:#2d1e0f;border:1px solid #78350f;border-radius:10px;padding:14px;margin-bottom:24px;">
        <span style="color:#f59e0b;font-weight:600;">⚠️ Atenção!</span>
        <span style="color:#fcd34d;font-size:14px;"> ${bills.length} conta${bills.length > 1 ? "s vencem" : " vence"} nos próximos 3 dias.</span>
      </div>
      ${list}
    `),
  });
}

export async function sendFutureBillReminder(
  email: string,
  items: Array<{ id: number; name: string; amount: number; reminderDate?: string }>
): Promise<void> {
  const itemsHtml = items.map((i) => {
    const actionUrl = `${process.env.NEXTAUTH_URL}/api/future-bills/accept?id=${i.id}&s=${process.env.EMAIL_ACTION_SECRET || ""}`;
    return `
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #2a3d31;">
        <div>
          <div style="color:#f0f9f4;font-size:14px;font-weight:500;">${i.name}</div>
          <div style="color:#4a6b58;font-size:12px;">Lembrete em ${i.reminderDate ? format(new Date(i.reminderDate), "dd/MM/yyyy", { locale: ptBR }) : "(data não definida)"}</div>
          <div style="margin-top:8px;">
            <a href="${actionUrl}" style="display:inline-block;background:#389671;color:#fff;text-decoration:none;
               padding:8px 14px;border-radius:8px;font-weight:600;font-size:13px;">Adicionar ao radar</a>
          </div>
        </div>
        <div style="color:#f59e0b;font-size:15px;font-weight:600;">R$ ${i.amount.toFixed(2).replace(".", ",")}</div>
      </div>`;
  }).join("");

  await resend.emails.send({
    from: FROM, to: email,
    subject: `📌 Lembrete: ${items.length} conta${items.length > 1 ? "s" : ""} futura(s) — Contas Cotidiano`,
    html: emailWrapper(`
      <div style="color:#4a6b58;font-size:13px;margin-bottom:20px;">Lembrete de contas futuras</div>
      ${itemsHtml}
    `),
  });
}

export async function sendInsightsEmail(email: string, bodyText: string): Promise<void> {
  await resend.emails.send({
    from: FROM, to: email,
    subject: `💡 Radar Financeiro Semanal — Contas Cotidiano`,
    html: emailWrapper(`
      <div style="color:#4a6b58;font-size:12px;margin-bottom:18px;">Radar Financeiro Semanal</div>
      <div style="color:#f0f9f4;font-size:14px;line-height:1.6;">${bodyText.replace(/\n/g, "<br/>")}</div>
      <div style="margin-top:18px;color:#4a6b58;font-size:13px;">Próximo radar: sábado que vem 💚</div>
    `),
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = `${process.env.NEXTAUTH_URL}/login/reset?token=${token}`;
  await resend.emails.send({
    from: FROM, to: email,
    subject: "🔑 Redefinir senha — Contas Cotidiano",
    html: emailWrapper(`
      <h2 style="color:#f0f9f4;font-size:18px;margin:0 0 12px;">Redefinir sua senha</h2>
      <p style="color:#8dcdb0;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Você solicitou a redefinição de senha. O link expira em <strong>1 hora</strong>.
      </p>
      <a href="${url}" style="display:inline-block;background:#389671;color:#fff;text-decoration:none;
         padding:12px 26px;border-radius:10px;font-weight:600;">Redefinir senha</a>
      <p style="color:#4a6b58;font-size:12px;margin:20px 0 0;">Se você não solicitou, ignore este e‑mail.</p>
    `),
  });
}

// ─── v2: Alertas de comportamento de risco ───────────────────────────────────

const ALERT_CONFIG: Record<string, { emoji: string; borderColor: string; bgColor: string }> = {
  danger: { emoji: "🚨", borderColor: "#7f1d1d", bgColor: "#2d1515" },
  warning: { emoji: "⚠️", borderColor: "#78350f", bgColor: "#2d1e0f" },
};

const TYPE_LABELS: Record<string, string> = {
  installments_growth: "Parcelamentos",
  fixed_growth: "Despesas Fixas",
  card_recurrence: "Cartão de Crédito",
};

export async function sendRiskAlertsEmail(
  email: string,
  alerts: DetectedAlert[],
  month: number,
  year: number,
): Promise<void> {
  const monthName = MONTHS_PT[month - 1];

  const alertsHtml = alerts.map((a) => {
    const cfg = ALERT_CONFIG[a.severity] ?? ALERT_CONFIG.warning;
    return `
      <div style="background:${cfg.bgColor};border:1px solid ${cfg.borderColor};border-radius:10px;
                  padding:16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:16px;">${cfg.emoji}</span>
          <span style="color:#f0f9f4;font-weight:600;font-size:14px;">${a.title}</span>
          <span style="margin-left:auto;font-size:11px;color:#4a6b58;text-transform:uppercase;
                       letter-spacing:0.5px;background:#1c2b22;padding:2px 8px;border-radius:20px;">
            ${TYPE_LABELS[a.type] ?? a.type}
          </span>
        </div>
        <p style="color:#8dcdb0;font-size:13px;line-height:1.6;margin:0;">${a.message}</p>
      </div>`;
  }).join("");

  const dangerCount = alerts.filter((a) => a.severity === "danger").length;
  const subjectPrefix = dangerCount > 0 ? "🚨" : "⚠️";

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${subjectPrefix} ${alerts.length} alerta${alerts.length > 1 ? "s" : ""} financeiro${alerts.length > 1 ? "s" : ""} — ${monthName}/${year}`,
    html: emailWrapper(`
      <div style="margin-bottom:20px;">
        <div style="color:#4a6b58;font-size:13px;">Alertas de comportamento de risco — ${monthName} ${year}</div>
        <h2 style="color:#f0f9f4;font-size:18px;margin:8px 0 0;">
          ${dangerCount > 0
        ? `${dangerCount} alerta${dangerCount > 1 ? "s críticos" : " crítico"} detectado${dangerCount > 1 ? "s" : ""}`
        : `${alerts.length} ponto${alerts.length > 1 ? "s" : ""} de atenção este mês`}
        </h2>
      </div>
      ${alertsHtml}
      <p style="color:#4a6b58;font-size:12px;margin-top:20px;">
        Esses alertas foram detectados comparando ${monthName}/${year} com o mês anterior.
        Acesse o dashboard para dispensar alertas já verificados.
      </p>
    `),
  });
}

// ─── v2: Lembrete de check-in semanal ────────────────────────────────────────

export async function sendCheckinReminderEmail(
  email: string,
  context: {
    weekNumber: number;
    month: number;
    year: number;
    pendingBills: number;
    pendingAmount: number;
    dueSoon: Array<{ name: string; amount: number; dueDay: number }>;
  }
): Promise<void> {
  const monthName = MONTHS_PT[context.month - 1];
  const BRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const dueSoonHtml = context.dueSoon.length > 0
    ? `<div style="margin-top:16px;">
        <p style="color:#f59e0b;font-size:12px;font-weight:600;margin:0 0 8px;">⚠️ Vencendo nos próximos 5 dias</p>
        ${context.dueSoon.map((d) => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #2a3d31;">
            <span style="color:#fcd34d;font-size:13px;">${d.name}</span>
            <span style="color:#4a6b58;font-size:13px;">dia ${d.dueDay} · ${BRL(d.amount)}</span>
          </div>`).join("")}
      </div>`
    : "";

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `🔄 Check-in da semana ${context.weekNumber} — ${monthName}/${context.year}`,
    html: emailWrapper(`
      <div style="margin-bottom:20px;">
        <div style="color:#4a6b58;font-size:13px;">Check-in semanal — semana ${context.weekNumber}</div>
        <h2 style="color:#f0f9f4;font-size:18px;margin:8px 0 0;">
          Hora de conversar sobre as finanças 💬
        </h2>
      </div>
      <div style="background:#1c2b22;border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#4a6b58;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Contas pendentes</span>
          <span style="color:#f59e0b;font-size:15px;font-weight:700;">${BRL(context.pendingAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#4a6b58;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Qtd. pendentes</span>
          <span style="color:#f0f9f4;font-size:15px;font-weight:600;">${context.pendingBills} conta${context.pendingBills !== 1 ? "s" : ""}</span>
        </div>
      </div>
      ${dueSoonHtml}
      <p style="color:#8dcdb0;font-size:13px;line-height:1.6;margin:20px 0 0;">
        Reservem 5 minutos para o check-in semanal. São apenas 5 perguntas que ajudam o casal a
        manter a mesma visão sobre o dinheiro.
      </p>
    `),
  });
}