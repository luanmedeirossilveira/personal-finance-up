// src/components/dashboard/Sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Landmark, LogOut, Plus, RefreshCcw, Sun } from "lucide-react";
import BillForm from "@/components/bills/BillForm";
import ThemeToggle from "@/components/ui/ThemeToggle";

// v3: 3 destinos fixos. A Revisão sai do menu e vira um ritual (gate) + ação.
const navItems = [
  { href: "/hoje", label: "Hoje", icon: Sun },
  { href: "/mes", label: "Mês", icon: CalendarDays },
  { href: "/patrimonio", label: "Patrimônio", icon: Landmark },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({ workingPeriod: period }: Readonly<{ workingPeriod: { month: number; year: number } }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-60 z-30"
        style={{ background: "rgb(var(--surface))", borderRight: "1px solid rgb(var(--border))" }}
      >
        <div className="px-6 py-6 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/android-chrome-192x192.png" alt="" width={32} height={32} className="w-8 h-8" />
          <span className="text-lg font-extrabold tracking-tight">
            Contas<span style={{ color: "rgb(var(--accent))" }}>.</span>
          </span>
        </div>

        <nav className="px-3 flex-1 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                prefetch
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{
                  background: active ? "rgb(var(--surface-raised))" : "transparent",
                  color: active ? "rgb(var(--text))" : "rgb(var(--text-muted))",
                }}
              >
                <Icon size={18} style={{ color: active ? "rgb(var(--accent))" : undefined }} />
                {label}
              </Link>
            );
          })}

          <div className="pt-4">
            <Link
              href="/revisao"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                border: "1px solid rgb(var(--border))",
                color: isActive(pathname, "/revisao") ? "rgb(var(--text))" : "rgb(var(--text-soft))",
              }}
            >
              <RefreshCcw size={16} />
              Revisão
            </Link>
          </div>
        </nav>

        <div className="px-3 py-4 space-y-1" style={{ borderTop: "1px solid rgb(var(--border))" }}>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl w-full text-sm font-medium transition-colors hover:bg-fg/5"
            style={{ color: "rgb(var(--text-muted))" }}
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile: topo enxuto */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14"
        style={{ background: "rgb(var(--surface) / 0.9)", borderBottom: "1px solid rgb(var(--border))", backdropFilter: "blur(12px)" }}
      >
        <span className="flex items-center gap-2 text-base font-extrabold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/favicon-32x32.png" alt="" width={24} height={24} className="w-6 h-6" />
          <span>
            Contas<span style={{ color: "rgb(var(--accent))" }}>.</span>
          </span>
        </span>
        <div className="flex items-center gap-1">
          <Link
            href="/revisao"
            aria-label="Revisão"
            className="p-2 rounded-lg"
            style={{ color: isActive(pathname, "/revisao") ? "rgb(var(--accent))" : "rgb(var(--text-soft))" }}
          >
            <RefreshCcw size={18} />
          </Link>
          <ThemeToggle compact />
          <button onClick={handleLogout} aria-label="Sair" className="p-2 rounded-lg" style={{ color: "rgb(var(--text-muted))" }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Mobile: barra inferior com "+" central */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 items-center px-2 pb-[env(safe-area-inset-bottom)]"
        style={{ background: "rgb(var(--surface) / 0.95)", borderTop: "1px solid rgb(var(--border))", backdropFilter: "blur(12px)" }}
      >
        {navItems.slice(0, 2).map((item) => (
          <BottomItem key={item.href} {...item} active={isActive(pathname, item.href)} />
        ))}
        <div className="flex justify-center order-none">
          <button
            onClick={() => setShowQuickAdd(true)}
            aria-label="Lançar conta"
            className="-mt-6 w-14 h-14 rounded-full flex items-center justify-center transition-transform active:scale-95"
            style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))", boxShadow: "var(--shadow)" }}
          >
            <Plus size={26} />
          </button>
        </div>
        <BottomItem {...navItems[2]} active={isActive(pathname, navItems[2].href)} />
      </nav>

      {showQuickAdd && (
        <BillForm
          bill={null}
          month={period.month}
          year={period.year}
          onClose={() => setShowQuickAdd(false)}
          onSave={() => {
            setShowQuickAdd(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function BottomItem({
  href,
  label,
  icon: Icon,
  active,
}: Readonly<{ href: string; label: string; icon: typeof Sun; active: boolean }>) {
  return (
    <Link
      href={href}
      prefetch
      className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold"
      style={{ color: active ? "rgb(var(--accent))" : "rgb(var(--text-muted))" }}
    >
      <Icon size={20} />
      {label}
    </Link>
  );
}
