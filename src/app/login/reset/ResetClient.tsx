"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import showToast from "@/components/ui/toast";

export default function ResetClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params?.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      showToast("Token ausente.");
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return showToast("Senha deve ter ao menos 6 caracteres.");
    if (password !== confirm) return showToast("Senhas não conferem.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        showToast("Senha redefinida com sucesso.");
        router.push("/login");
      } else {
        const body = await res.json().catch(() => ({}));
        showToast(body?.message || "Erro ao redefinir senha.");
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
      <h1 className="text-2xl font-semibold mb-4">Redefinir senha</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          required
          placeholder="Nova senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 rounded border bg-transparent"
        />
        <input
          type="password"
          required
          placeholder="Confirmar senha"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full p-3 rounded border bg-transparent"
        />
        <div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </div>
      </form>
    </div>
  );
}
