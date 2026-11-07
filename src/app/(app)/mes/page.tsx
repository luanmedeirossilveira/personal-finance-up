import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getWorkingPeriod } from "@/lib/month-closing";
import MonthView from "@/components/month/MonthView";

export const dynamic = "force-dynamic";

export default async function MesPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  // Abre no mês seguinte ao último fechado ("Fechar conta").
  const workingPeriod = await getWorkingPeriod(user.id);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Mês</h1>
        <p className="text-sm mt-1" style={{ color: "rgb(var(--text-muted))" }}>
          O mês fecha? Contas, limites e entradas.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="card p-8 text-center" style={{ color: "rgb(var(--text-muted))" }}>
            Carregando...
          </div>
        }
      >
        <MonthView workingPeriod={workingPeriod} />
      </Suspense>
    </div>
  );
}
