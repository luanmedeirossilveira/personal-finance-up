import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DebtsManager from "@/components/debts/DebtsManager";

export default async function DebtsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Dívidas
        </h1>
        <p className="text-sm mt-1" style={{ color: "#4a6b58" }}>
          Gerencie suas dívidas e vencimentos
        </p>
      </div>
      <DebtsManager />
    </div>
  );
}