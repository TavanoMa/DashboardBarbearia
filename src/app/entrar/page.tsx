"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const destino = params.get("next") || "/";
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    document.getElementById("senha")?.focus();
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/gate/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.error || "Falha ao entrar");
        setCarregando(false);
        return;
      }
      // Redireciona e força reload pra o proxy re-checar o cookie.
      window.location.href = destino.startsWith("/") ? destino : "/";
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro de rede");
      setCarregando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-black px-4 overflow-y-auto">
      <form
        onSubmit={enviar}
        className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Cacique's"
            className="w-16 h-16 mb-3 rounded-full bg-black object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <h1 className="text-xl font-semibold text-white">DashBoard Cacique&apos;s</h1>
          <p className="text-xs text-zinc-400 mt-1">Acesso restrito</p>
        </div>

        <label htmlFor="senha" className="block text-xs text-zinc-400 mb-2">
          Senha
        </label>
        <div className="relative">
          <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            disabled={carregando}
            autoComplete="current-password"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
            placeholder="digite a senha"
          />
        </div>

        {erro && (
          <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        <button
          type="submit"
          disabled={carregando || !senha}
          className="mt-5 w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg py-2.5 transition-colors"
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function PaginaEntrar() {
  return (
    <Suspense fallback={null}>
      <Formulario />
    </Suspense>
  );
}
