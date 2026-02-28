import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import BillsManager from "@/components/bills/BillsManager";
import Sidebar from "@/components/dashboard/Sidebar";

export default async function ContasPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Contas
        </h1>
        <p className="text-sm mt-1" style={{ color: "#4a6b58" }}>
          Gerencie suas contas mês a mês
        </p>
      </div>
      <Suspense fallback={<div className="card p-8 text-center" style={{ color: "#4a6b58" }}>Carregando...</div>}>
        <BillsManager />
      </Suspense>
    </div>
  );
}
