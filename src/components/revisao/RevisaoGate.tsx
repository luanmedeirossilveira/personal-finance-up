"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import ModalPortal from "@/components/ui/ModalPortal";
import { SNOOZE_HOURS } from "@/lib/revisao-shared";
import type { GateMode, RevisaoContext } from "@/lib/revisao";
import RevisaoFlow from "./RevisaoFlow";

// Modal da Revisão obrigatória: não fecha até concluir. Única saída: adiar 2h, uma vez por semana.
export default function RevisaoGate({ context, mode }: Readonly<{ context: RevisaoContext; mode: GateMode }>) {
  const router = useRouter();
  const [snoozing, setSnoozing] = useState(false);

  async function snooze() {
    setSnoozing(true);
    const res = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "snooze" }),
    });
    setSnoozing(false);
    if (res.ok) router.refresh();
  }

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] backdrop-blur-md"
        style={{ background: "rgb(var(--bg) / 0.6)" }}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revisao-gate-title"
        className="fixed inset-0 z-[101] flex justify-center items-end sm:items-center sm:p-4"
      >
        <div className="card w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-2xl p-5 sm:p-6 space-y-4">
          <div>
            <h2 id="revisao-gate-title" className="text-xl font-bold">
              {mode === "monthly" ? "Hora de fechar o mês" : "Revisão da semana"}
            </h2>
            <p className="text-sm mt-1" style={{ color: "rgb(var(--text-muted))" }}>
              Leva de 3 a 5 minutos: já vem preenchida com os seus números.
            </p>
          </div>

          <RevisaoFlow context={context} mode={mode} onDone={() => router.refresh()} />

          {context.status.snoozeAvailable && (
            <button
              onClick={snooze}
              disabled={snoozing}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium pt-2 disabled:opacity-60"
              style={{ color: "rgb(var(--text-muted))" }}
            >
              <Clock size={13} />
              {snoozing ? "Adiando..." : `Adiar ${SNOOZE_HOURS} horas (1x por semana)`}
            </button>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
