import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import FutureBillsManager from "@/components/future/FutureBillsManager";

export default async function FuturePage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Contas futuras
        </h1>
        <p className="text-sm mt-1" style={{ color: "#4a6b58" }}>
          Anotações de contas que devem entrar no radar em breve
        </p>
      </div>
      <FutureBillsManager />
    </div>
  );
}
