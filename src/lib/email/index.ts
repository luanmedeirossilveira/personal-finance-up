import { Resend } from "resend";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || "contas@seudominio.com";

export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<void> {
  const url = `${process.env.NEXTAUTH_URL}/api/auth/verify?token=${token}`;
  try {
    console.log(`Sending verification email to ${email}`);

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: "🔐 Verificar acesso — Contas Cotidiano",
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="margin:0;padding:0;background:#0f1a16;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <div style="max-width:520px;margin:48px auto;padding:40px;background:#162019;border-radius:16px;border:1px solid #2a3d31;">
          <div style="margin-bottom:32px;">
            <span style="font-size:28px;font-weight:800;color:#5ab28d;letter-spacing:-1px;">Contas</span>
            <span style="font-size:28px;font-weight:300;color:#8dcdb0;letter-spacing:-1px;"> Cotidiano</span>
          </div>
          <h1 style="color:#f0f9f4;font-size:20px;font-weight:600;margin:0 0 12px;">Verificar seu acesso</h1>
          <p style="color:#8dcdb0;font-size:15px;line-height:1.6;margin:0 0 32px;">
            Clique no botão abaixo para confirmar seu acesso. Este link expira em <strong style="color:#f0f9f4;">24 horas</strong>.
          </p>
          <a href="${url}" style="display:inline-block;background:#389671;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:0.3px;">
            Verificar e entrar
          </a>
          <p style="color:#4a6b58;font-size:12px;margin:32px 0 0;">
            Se você não solicitou este acesso, ignore este email.
          </p>
        </div>
      </body>
      </html>
    `,
    });
  } catch (err) {
    console.error("sendVerificationEmail error:", err);
    throw err;
  }
}

export async function sendMonthlyOverview(
  email: string,
  data: {
    month: string;
    year: number;
    totalBills: number;
    paidBills: number;
    pendingBills: number;
    totalIncome: number;
    balance: number;
    upcomingDue: Array<{ name: string; amount: number; dueDay: number }>;
  }
): Promise<void> {
  const balanceColor = data.balance >= 0 ? "#5ab28d" : "#ef4444";
  const upcomingList = data.upcomingDue
    .slice(0, 5)
    .map(
      (b) =>
        `<tr>
          <td style="padding:8px 0;color:#8dcdb0;font-size:14px;">${b.name}</td>
          <td style="padding:8px 0;color:#f0f9f4;font-size:14px;text-align:right;">R$ ${b.amount.toFixed(2).replace(".", ",")}</td>
          <td style="padding:8px 0;color:#4a6b58;font-size:14px;text-align:right;">dia ${b.dueDay}</td>
        </tr>`
    )
    .join("");

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `📊 Panorama de ${data.month} ${data.year} — Contas Cotidiano`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#0f1a16;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <div style="max-width:560px;margin:48px auto;padding:40px;background:#162019;border-radius:16px;border:1px solid #2a3d31;">
          <div style="margin-bottom:24px;">
            <span style="font-size:22px;font-weight:800;color:#5ab28d;">Contas</span>
            <span style="font-size:22px;font-weight:300;color:#8dcdb0;"> Cotidiano</span>
            <span style="display:block;color:#4a6b58;font-size:13px;margin-top:4px;">Panorama de ${data.month} ${data.year}</span>
          </div>

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

          ${
            data.upcomingDue.length > 0
              ? `
          <div style="margin-bottom:24px;">
            <h3 style="color:#8dcdb0;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Próximos vencimentos</h3>
            <table style="width:100%;border-collapse:collapse;">
              ${upcomingList}
            </table>
          </div>
          `
              : ""
          }

          <a href="${process.env.NEXTAUTH_URL}/dashboard" style="display:inline-block;background:#389671;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">
            Ver dashboard completo →
          </a>
        </div>
      </body>
      </html>
    `,
  });
}

export async function sendDueSoonAlert(
  email: string,
  bills: Array<{ name: string; amount: number; dueDay: number; daysLeft: number }>
): Promise<void> {
  const list = bills
    .map(
      (i) =>
        `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #2a3d31;">
          <div>
            <div style="color:#f0f9f4;font-size:14px;font-weight:500;">${i.name}</div>
            <div style="color:#4a6b58;font-size:12px;">Lembrete em ${i.dueDay ? format(new Date(i.dueDay), "dd/MM/yyyy", { locale: ptBR }) : "(data não definida)"}</div>
          </div>
          <div style="color:#f59e0b;font-size:15px;font-weight:600;">R$ ${i.amount.toFixed(2).replace(".", ",")}</div>
        </div>`
    )
    .join("");

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `⚠️ ${bills.length} conta${bills.length > 1 ? "s vencem" : " vence"} em breve — Contas Cotidiano`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#0f1a16;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <div style="max-width:520px;margin:48px auto;padding:40px;background:#162019;border-radius:16px;border:1px solid #2a3d31;">
          <div style="margin-bottom:24px;">
            <span style="font-size:22px;font-weight:800;color:#5ab28d;">Contas</span>
            <span style="font-size:22px;font-weight:300;color:#8dcdb0;"> Cotidiano</span>
          </div>
          <div style="background:#2d1e0f;border:1px solid #78350f;border-radius:10px;padding:14px;margin-bottom:24px;">
            <span style="color:#f59e0b;font-weight:600;">⚠️ Atenção!</span>
            <span style="color:#fcd34d;font-size:14px;"> ${bills.length} conta${bills.length > 1 ? "s vencem" : " vence"} nos próximos 3 dias.</span>
          </div>
          <div>${list}</div>
          <div style="margin-top:24px;">
            <a href="${process.env.NEXTAUTH_URL}/dashboard" style="display:inline-block;background:#389671;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">
              Marcar como pago →
            </a>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

export async function sendFutureBillReminder(
  email: string,
  items: Array<{ id: number; name: string; amount: number; reminderDate?: string }>
): Promise<void> {
  const itemsHtml = items
    .map((i) => {
      const actionUrl = `${process.env.NEXTAUTH_URL}/api/future-bills/accept?id=${i.id}&s=${process.env.EMAIL_ACTION_SECRET || ""}`;
      return `
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #2a3d31;">
          <div>
            <div style="color:#f0f9f4;font-size:14px;font-weight:500;">${i.name}</div>
            <div style="color:#4a6b58;font-size:12px;">Lembrete em ${i.reminderDate ? format(new Date(i.reminderDate), "dd/MM/yyyy", { locale: ptBR }) : "(data não definida)"}</div>
            <div style="margin-top:8px;"><a href="${actionUrl}" style="display:inline-block;background:#389671;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-weight:600;font-size:13px;">Adicionar ao radar</a></div>
          </div>
          <div style="color:#f59e0b;font-size:15px;font-weight:600;">R$ ${i.amount.toFixed(2).replace(".", ",")}</div>
        </div>`;
    })
    .join("");

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `📌 Lembrete: ${items.length} conta${items.length > 1 ? "s" : ""} futura(s) — Contas Cotidiano`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#0f1a16;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <div style="max-width:520px;margin:48px auto;padding:40px;background:#162019;border-radius:16px;border:1px solid #2a3d31;">
          <div style="margin-bottom:24px;">
            <span style="font-size:22px;font-weight:800;color:#5ab28d;">Contas</span>
            <span style="font-size:22px;font-weight:300;color:#8dcdb0;"> Cotidiano</span>
            <div style="color:#4a6b58;font-size:13px;margin-top:6px;">Lembrete de contas futuras</div>
          </div>
          ${itemsHtml}
          <div style="margin-top:24px;">
            <a href="${process.env.NEXTAUTH_URL}/future" style="display:inline-block;background:#389671;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">
              Ver e adicionar ao radar →
            </a>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

export async function sendInsightsEmail(email: string, bodyText: string): Promise<void> {
  const html = `<!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#0f1a16;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <div style="max-width:680px;margin:32px auto;padding:36px;background:#162019;border-radius:12px;border:1px solid #2a3d31;">
      <div style="margin-bottom:18px;">
        <span style="font-size:20px;font-weight:800;color:#5ab28d;">Contas</span>
        <span style="font-size:20px;font-weight:300;color:#8dcdb0;"> Cotidiano</span>
        <div style="color:#4a6b58;font-size:12px;margin-top:6px;">Radar Financeiro Semanal</div>
      </div>
      <div style="color:#f0f9f4;font-size:14px;line-height:1.6;">${bodyText.replace(/\n/g, "<br/>")}</div>
      <div style="margin-top:18px;color:#4a6b58;font-size:13px;">Próximo radar: sábado que vem 💚</div>
    </div>
  </body>
  </html>`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `💡 Radar Financeiro Semanal — Contas Cotidiano`,
    html,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = `${process.env.NEXTAUTH_URL}/login/reset?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "🔑 Redefinir senha — Contas Cotidiano",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#0f1a16;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <div style="max-width:520px;margin:48px auto;padding:40px;background:#162019;border-radius:16px;border:1px solid #2a3d31;">
          <div style="margin-bottom:24px;">
            <span style="font-size:22px;font-weight:800;color:#5ab28d;">Contas</span>
            <span style="font-size:22px;font-weight:300;color:#8dcdb0;"> Cotidiano</span>
          </div>
          <h2 style="color:#f0f9f4;font-size:18px;margin:0 0 12px;">Redefinir sua senha</h2>
          <p style="color:#8dcdb0;font-size:14px;line-height:1.6;margin:0 0 20px;">Você solicitou a redefinição de senha. Clique no botão abaixo para definir uma nova senha. O link expira em <strong>1 hora</strong>.</p>
          <a href="${url}" style="display:inline-block;background:#389671;color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-weight:600;">Redefinir senha</a>
          <p style="color:#4a6b58;font-size:12px;margin:20px 0 0;">Se você não solicitou, ignore este e‑mail.</p>
        </div>
      </body>
      </html>
    `,
  });
}

