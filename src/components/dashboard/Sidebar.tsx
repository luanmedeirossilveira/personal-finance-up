"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  LogOut,
  Menu,
  X,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contas", label: "Contas", icon: Receipt },
  { href: "/future", label: "Futuras", icon: TrendingUp },
  { href: "/debts", label: "Dívidas", icon: TrendingDown },
];

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="px-6 py-6 mb-4">
        <h1 className="text-xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          <span style={{ color: "#5ab28d" }}>Contas</span>
          <span style={{ color: "#8dcdb0", fontWeight: 300 }}> Cotidiano</span>
        </h1>
      </div>

      {/* Nav */}
      <nav className="px-3 flex-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              prefetch={true}
              className="flex items-center gap-3 px-4 py-3 rounded-xl mb-1 text-sm font-medium transition-all"
              style={{
                background: active ? "rgba(56,150,113,0.15)" : "transparent",
                color: active ? "#5ab28d" : "#4a6b58",
                border: active ? "1px solid rgba(56,150,113,0.25)" : "1px solid transparent",
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t" style={{ borderColor: "#2a3d31" }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-sm font-medium transition-all hover:bg-red-500/10"
          style={{ color: "#4a6b58" }}
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64"
        style={{ background: "#162019", borderRight: "1px solid #2a3d31" }}
      >
        <NavContent />
      </aside>

      {/* Mobile Top Bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-4"
        style={{ background: "#162019", borderBottom: "1px solid #2a3d31" }}
      >
        <h1 className="text-lg font-black" style={{ fontFamily: "var(--font-display)" }}>
          <span style={{ color: "#5ab28d" }}>Contas</span>
          <span style={{ color: "#8dcdb0", fontWeight: 300 }}> Cotidiano</span>
        </h1>
        <button
          onClick={() => setMobileOpen(true)}
          style={{ color: "#8dcdb0" }}
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="lg:hidden fixed left-0 top-0 h-full w-72 z-50 flex flex-col animate-slide-in"
            style={{ background: "#162019", borderRight: "1px solid #2a3d31" }}
          >
            <div className="flex justify-end p-4">
              <button onClick={() => setMobileOpen(false)} style={{ color: "#4a6b58" }}>
                <X size={24} />
              </button>
            </div>
            <NavContent />
          </aside>
        </>
      )}
    </>
  );
}
