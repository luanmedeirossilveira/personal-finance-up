import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getRevisaoContext } from "@/lib/revisao";
import RevisaoView from "@/components/revisao/RevisaoView";

export const dynamic = "force-dynamic";

export default async function RevisaoPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const context = await getRevisaoContext(user.id);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Revisão</h1>
        <p className="text-sm mt-1" style={{ color: "rgb(var(--text-muted))" }}>
          Ritual semanal e fechamento do mês, com a evolução do que você sente e decide.
        </p>
      </header>
      <RevisaoView context={context} />
    </div>
  );
}
