import { getSession } from "@/lib/auth";
import YearOverview from "@/components/dashboard/YearOverview";

export default async function DashboardPage() {
  const user = await getSession();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "#4a6b58" }}>
          Visão geral das suas finanças
        </p>
      </div>
      <YearOverview />
    </div>
  );
}
