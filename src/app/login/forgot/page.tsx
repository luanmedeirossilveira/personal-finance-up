"use client";

import { useState } from "react";
import showToast from "@/components/ui/toast";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        showToast("Se o e-mail existir, enviamos instruções para redefinir a senha.");
      } else {
        showToast("Erro ao enviar instruções.");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro na requisição.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-24 p-6 bg-surface rounded-lg">
      <h1 className="text-2xl font-semibold mb-4">Esqueci minha senha</h1>
      <p className="text-sm text-muted mb-4">Informe seu e‑mail e enviaremos um link para redefinir a senha.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 rounded border bg-transparent"
        />
        <div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Enviar link"}
          </button>
        </div>
      </form>
    </div>
  );
}
