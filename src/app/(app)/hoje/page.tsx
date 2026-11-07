import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTodayData } from "@/lib/today";
import TodayView from "@/components/today/TodayView";

export const dynamic = "force-dynamic";

function greeting(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function HojePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const now = new Date();
  const data = await getTodayData(user.id, now);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-sm font-semibold" style={{ color: "rgb(var(--text-muted))" }}>
          {greeting(now)} · {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </h1>
      </header>
      <TodayView data={data} />
    </div>
  );
}
