"use client";

import { useState, useEffect } from "react";
import { Save, CheckCircle, AlertCircle, Key, Globe } from "lucide-react";
import Header from "@/components/Header";

export default function ConfiguracoesPage() {
  const [phpSessionId, setPhpSessionId] = useState("");
  const [appblzId, setAppblzId] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("appbarber_config");
    if (saved) {
      const config = JSON.parse(saved);
      setPhpSessionId(config.phpSessionId || "");
      setAppblzId(config.appblzId || "");
    }
  }, []);

  const handleSave = async () => {
    setStatus("saving");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phpSessionId, appblzId }),
      });
      if (res.ok) {
        localStorage.setItem(
          "appbarber_config",
          JSON.stringify({ phpSessionId, appblzId })
        );
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const res = await fetch("/api/test-connection");
      const data = await res.json();
      setTestResult(
        data.connected
          ? `Conectado! ${data.count} agendamentos encontrados.`
          : "Falha na conexão. Verifique os cookies."
      );
    } catch {
      setTestResult("Erro ao testar conexão.");
    }
  };

  return (
    <>
      <Header title="Configurações" />
      <main className="flex-1 p-6 max-w-2xl">
        <h2 className="text-xl font-bold mb-6">Configurações</h2>

        <div className="bg-card-bg border border-card-border rounded-xl p-6 space-y-6">
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Key size={18} className="text-accent" />
              Conexão com App Barber
            </h3>
            <p className="text-sm text-muted mb-4">
              Para conectar ao App Barber, faça login no sistema normalmente,
              depois copie os cookies de sessão do seu navegador.
            </p>

            <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium mb-2">Como obter os cookies:</p>
              <ol className="text-xs text-muted space-y-1.5 list-decimal list-inside">
                <li>
                  Acesse{" "}
                  <span className="text-accent">
                    sistema.appbarber.com.br
                  </span>{" "}
                  e faça login
                </li>
                <li>Pressione F12 para abrir as ferramentas do desenvolvedor</li>
                <li>Vá na aba Application &gt; Cookies</li>
                <li>Copie o valor de PHPSESSID e APPBLZ_ID</li>
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                PHPSESSID
              </label>
              <input
                type="text"
                value={phpSessionId}
                onChange={(e) => setPhpSessionId(e.target.value)}
                placeholder="Cole o valor do cookie PHPSESSID aqui"
                className="w-full px-4 py-2.5 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                APPBLZ_ID
              </label>
              <input
                type="text"
                value={appblzId}
                onChange={(e) => setAppblzId(e.target.value)}
                placeholder="Cole o valor do cookie APPBLZ_ID aqui"
                className="w-full px-4 py-2.5 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!phpSessionId || status === "saving"}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-sidebar-bg rounded-lg font-medium text-sm hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {status === "saving" ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={handleTest}
              className="flex items-center gap-2 px-5 py-2.5 border border-card-border rounded-lg text-sm hover:bg-accent/10 transition-colors"
            >
              <Globe size={16} />
              Testar Conexão
            </button>
          </div>

          {status === "saved" && (
            <div className="flex items-center gap-2 text-success text-sm">
              <CheckCircle size={16} />
              Configurações salvas com sucesso!
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 text-danger text-sm">
              <AlertCircle size={16} />
              Erro ao salvar. Tente novamente.
            </div>
          )}
          {testResult && (
            <div
              className={`flex items-center gap-2 text-sm ${
                testResult.includes("Conectado") ? "text-success" : "text-danger"
              }`}
            >
              {testResult.includes("Conectado") ? (
                <CheckCircle size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              {testResult}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
