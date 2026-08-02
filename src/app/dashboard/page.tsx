import DashboardView from "@/components/dashboard/DashboardView";

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "#4a6b58" }}>
          Seu controle: da semana ao mês, comparando com o mês anterior
        </p>
      </div>
      <DashboardView />
    </div>
  );
}
