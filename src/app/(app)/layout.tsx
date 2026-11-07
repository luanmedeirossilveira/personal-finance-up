import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/dashboard/Sidebar";
import RevisaoGate from "@/components/revisao/RevisaoGate";
import { getWorkingPeriod } from "@/lib/month-closing";
import { getRevisaoContext, getRevisaoStatus } from "@/lib/revisao";

// Layout das rotas autenticadas. A checagem da Revisão fica aqui (server component),
// não no middleware: ele roda no edge e não deve consultar o banco a cada request.
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getSession();
  if (!user) redirect("/login");

  const [status, workingPeriod] = await Promise.all([getRevisaoStatus(user.id), getWorkingPeriod(user.id)]);
  const gateContext = status.due ? await getRevisaoContext(user.id) : null;

  return (
    <div className="min-h-screen">
      <Sidebar workingPeriod={workingPeriod} />
      <main className="lg:ml-60 min-w-0">
        <div className="h-14 lg:hidden" />
        <div className="mx-auto max-w-6xl px-4 pt-5 pb-28 md:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
      {status.due && gateContext && <RevisaoGate context={gateContext} mode={status.due} />}
    </div>
  );
}
