"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"login" | "sent">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao fazer login");
        return;
      }

      if (data.requiresVerification) {
        setStep("sent");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{
      background: "radial-gradient(ellipse at 30% 20%, rgba(56,150,113,0.12) 0%, transparent 60%), #0f1a16"
    }}>
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            <span style={{ color: "#5ab28d" }}>Contas</span>
            <span style={{ color: "#8dcdb0", fontWeight: 300 }}> Cotidiano</span>
          </h1>
          <p className="text-sm mt-2" style={{ color: "#4a6b58" }}>Controle financeiro pessoal</p>
        </div>

        {step === "login" ? (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "#8dcdb0", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-base"
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "#8dcdb0", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-base"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm py-3 px-4 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: loading ? "#2a3d31" : "#389671",
                color: loading ? "#4a6b58" : "#fff",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <p className="text-center text-xs" style={{ color: "#4a6b58" }}>
              Primeiro acesso? Insira seu email e a senha padrão.<br />
              Um link de verificação será enviado.
            </p>
          </form>
        ) : (
          <div className="card p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(56,150,113,0.15)", border: "1px solid rgba(56,150,113,0.3)" }}>
              <span className="text-2xl">📧</span>
            </div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Verifique seu email
            </h2>
            <p className="text-sm" style={{ color: "#8dcdb0" }}>
              Enviamos um link de acesso para<br />
              <strong style={{ color: "#f0f9f4" }}>{email}</strong>
            </p>
            <p className="text-xs" style={{ color: "#4a6b58" }}>
              O link expira em 24 horas. Depois de verificar, você não precisará verificar novamente por 30 dias.
            </p>
            <button
              onClick={() => setStep("login")}
              className="text-xs underline"
              style={{ color: "#4a6b58" }}
            >
              Tentar com outro email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
