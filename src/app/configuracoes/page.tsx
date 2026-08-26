"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LogIn,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Shield,
  Store,
  Wifi,
  WifiOff,
  Key,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import Header from "@/components/Header";

// reCAPTCHA v3 site key from AppBarber login page
const RECAPTCHA_SITE_KEY = "6LdVO78aAAAAAPCYO_iegSATfVfd9bEAX25U_czl";

interface StoreStatus {
  id: string;
  name: string;
  connected: boolean;
  lastVerified: string | null;
}

interface Establishment {
  code: string;
  name: string;
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (
        siteKey: string,
        options: { action: string }
      ) => Promise<string>;
    };
  }
}

export default function ConfiguracoesPage() {
  // --- State ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginStep, setLoginStep] = useState<
    "idle" | "loading" | "selecting" | "authenticating" | "done" | "error"
  >("idle");
  const [loginMessage, setLoginMessage] = useState("");
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedEstablishments, setSelectedEstablishments] = useState<
    Set<string>
  >(new Set());

  const [storeStatuses, setStoreStatuses] = useState<StoreStatus[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [hasCredentials, setHasCredentials] = useState(false);

  const [showManual, setShowManual] = useState(false);
  const [manualStores, setManualStores] = useState<
    Array<{ id: string; name: string; phpSessionId: string }>
  >([{ id: "", name: "", phpSessionId: "" }]);
  const [manualStatus, setManualStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const recaptchaLoaded = useRef(false);

  // --- Load reCAPTCHA script ---
  useEffect(() => {
    if (recaptchaLoaded.current) return;
    recaptchaLoaded.current = true;

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // --- Fetch status on mount ---
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      setStoreStatuses(data.stores || []);
      setHasCredentials(data.hasCredentials || false);
    } catch {
      // ignore
    }
    setStatusLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // --- Get reCAPTCHA token ---
  const getRecaptchaToken = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.grecaptcha) {
        reject(new Error("reCAPTCHA não carregou. Recarregue a página."));
        return;
      }
      window.grecaptcha.ready(() => {
        window
          .grecaptcha!.execute(RECAPTCHA_SITE_KEY, { action: "submit" })
          .then(resolve)
          .catch(reject);
      });
    });
  };

  // --- Login Step 1: Discover ---
  const handleLogin = async () => {
    if (!email || !password) return;

    setLoginStep("loading");
    setLoginMessage("Conectando ao AppBarber...");

    try {
      const token = await getRecaptchaToken();

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, recaptchaToken: token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginStep("error");
        setLoginMessage(data.error || "Erro na autenticação");
        return;
      }

      // Multiple establishments — user picks which ones
      if (data.needsSelection && data.establishments) {
        setEstablishments(data.establishments);
        setSelectedEstablishments(
          new Set(data.establishments.map((e: Establishment) => e.code))
        );
        setLoginStep("selecting");
        setLoginMessage("");
        return;
      }

      // Single establishment — done
      if (data.authenticated) {
        setLoginStep("done");
        setLoginMessage(
          `Conectado! ${data.stores.length} loja(s) configurada(s).`
        );
        fetchStatus();
        return;
      }

      setLoginStep("error");
      setLoginMessage("Resposta inesperada do servidor");
    } catch (err) {
      setLoginStep("error");
      setLoginMessage(
        err instanceof Error
          ? err.message
          : "Erro de conexão. Tente novamente."
      );
    }
  };

  // --- Login Step 2: Authenticate selected establishments ---
  const handleAuthenticateSelected = async () => {
    if (selectedEstablishments.size === 0) return;

    setLoginStep("authenticating");
    setLoginMessage("Autenticando nas lojas selecionadas...");

    try {
      const token = await getRecaptchaToken();
      const selected = establishments.filter((e) =>
        selectedEstablishments.has(e.code)
      );

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          recaptchaToken: token,
          establishments: selected,
        }),
      });

      const data = await res.json();

      if (data.authenticated) {
        setLoginStep("done");
        setLoginMessage(
          `Conectado! ${data.stores.length} loja(s) configurada(s).` +
            (data.errors ? ` Erros: ${data.errors.join(", ")}` : "")
        );
        fetchStatus();
      } else {
        setLoginStep("error");
        setLoginMessage(data.error || "Falha na autenticação");
      }
    } catch (err) {
      setLoginStep("error");
      setLoginMessage(
        err instanceof Error ? err.message : "Erro de conexão."
      );
    }
  };

  // --- Manual cookie save ---
  const handleManualSave = async () => {
    const validStores = manualStores.filter(
      (s) => s.id && s.name && s.phpSessionId
    );
    if (validStores.length === 0) return;

    setManualStatus("saving");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stores: validStores }),
      });

      if (res.ok) {
        setManualStatus("saved");
        fetchStatus();
        setTimeout(() => setManualStatus("idle"), 3000);
      } else {
        setManualStatus("error");
      }
    } catch {
      setManualStatus("error");
    }
  };

  // --- Toggle establishment selection ---
  const toggleEstablishment = (code: string) => {
    setSelectedEstablishments((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // --- Keepalive test ---
  const handleKeepalive = async () => {
    setStatusLoading(true);
    try {
      await fetch("/api/cron/keepalive");
      await fetchStatus();
    } catch {
      setStatusLoading(false);
    }
  };

  return (
    <>
      <Header title="Configurações" />
      <main className="flex-1 p-4 sm:p-6 max-w-3xl space-y-6 overflow-y-auto">
        {/* --- Connection Status --- */}
        <section className="bg-card-bg border border-card-border rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Shield size={18} className="text-accent" />
              Status das Lojas
            </h3>
            <button
              onClick={handleKeepalive}
              disabled={statusLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-card-border rounded-lg hover:bg-accent/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={statusLoading ? "animate-spin" : ""}
              />
              Verificar
            </button>
          </div>

          {statusLoading && storeStatuses.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted py-4">
              <Loader2 size={16} className="animate-spin" />
              Verificando conexões...
            </div>
          ) : storeStatuses.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted py-4">
              <AlertCircle size={16} />
              Nenhuma loja configurada. Faça login abaixo para conectar.
            </div>
          ) : (
            <div className="space-y-3">
              {storeStatuses.map((store) => (
                <div
                  key={store.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-card-border"
                >
                  <div className="flex items-center gap-3">
                    <Store size={16} className="text-muted" />
                    <div>
                      <p className="text-sm font-medium">{store.name}</p>
                      <p className="text-xs text-muted">
                        {store.lastVerified
                          ? `Verificado: ${new Date(store.lastVerified).toLocaleString("pt-BR")}`
                          : "Não verificado"}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      store.connected
                        ? "bg-success/10 text-success"
                        : "bg-danger/10 text-danger"
                    }`}
                  >
                    {store.connected ? (
                      <Wifi size={12} />
                    ) : (
                      <WifiOff size={12} />
                    )}
                    {store.connected ? "Online" : "Offline"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* --- Login with AppBarber --- */}
        <section className="bg-card-bg border border-card-border rounded-xl p-5 sm:p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-2">
            <LogIn size={18} className="text-accent" />
            Conectar ao AppBarber
          </h3>
          <p className="text-sm text-muted mb-5">
            Faça login com suas credenciais do AppBarber para conectar
            automaticamente todas as suas lojas.
          </p>

          {loginStep === "done" ? (
            <div className="flex items-center gap-2 text-success text-sm p-4 bg-success/5 rounded-lg border border-success/20">
              <CheckCircle size={18} />
              {loginMessage}
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Email / Usuário
                  </label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Seu email de login no AppBarber"
                    className="w-full px-4 py-2.5 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                    disabled={
                      loginStep === "loading" || loginStep === "authenticating"
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha do AppBarber"
                    className="w-full px-4 py-2.5 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                    disabled={
                      loginStep === "loading" || loginStep === "authenticating"
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLogin();
                    }}
                  />
                </div>
              </div>

              {/* Establishment selection */}
              {loginStep === "selecting" && establishments.length > 0 && (
                <div className="mb-4 p-4 bg-accent/5 rounded-lg border border-accent/20">
                  <p className="text-sm font-medium mb-3">
                    Selecione as lojas para conectar:
                  </p>
                  <div className="space-y-2 mb-4">
                    {establishments.map((est) => (
                      <label
                        key={est.code}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-card-border cursor-pointer hover:border-accent/50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEstablishments.has(est.code)}
                          onChange={() => toggleEstablishment(est.code)}
                          className="w-4 h-4 rounded text-accent"
                        />
                        <Store size={16} className="text-muted" />
                        <span className="text-sm">{est.name}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={handleAuthenticateSelected}
                    disabled={selectedEstablishments.size === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-accent text-sidebar-bg rounded-lg font-medium text-sm hover:bg-accent-light transition-colors disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    Conectar {selectedEstablishments.size} loja
                    {selectedEstablishments.size !== 1 ? "s" : ""}
                  </button>
                </div>
              )}

              {loginStep !== "selecting" && (
                <button
                  onClick={handleLogin}
                  disabled={
                    !email ||
                    !password ||
                    loginStep === "loading" ||
                    loginStep === "authenticating"
                  }
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent text-sidebar-bg rounded-lg font-medium text-sm hover:bg-accent-light transition-colors disabled:opacity-50"
                >
                  {loginStep === "loading" || loginStep === "authenticating" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <LogIn size={16} />
                  )}
                  {loginStep === "loading"
                    ? "Conectando..."
                    : loginStep === "authenticating"
                      ? "Autenticando lojas..."
                      : "Entrar"}
                </button>
              )}

              {loginStep === "error" && (
                <div className="flex items-start gap-2 text-danger text-sm mt-3 p-3 bg-danger/5 rounded-lg border border-danger/20">
                  <XCircle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p>{loginMessage}</p>
                    {loginMessage.includes("reCaptcha") && (
                      <p className="mt-1 text-xs text-muted">
                        O reCAPTCHA pode não funcionar neste domínio. Use a
                        opção manual abaixo.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* --- Manual Cookie Entry (Fallback) --- */}
        <section className="bg-card-bg border border-card-border rounded-xl p-5 sm:p-6">
          <button
            onClick={() => setShowManual(!showManual)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="font-semibold flex items-center gap-2">
              <Key size={18} className="text-muted" />
              Configuração Manual (Avançado)
            </h3>
            {showManual ? (
              <ChevronUp size={18} className="text-muted" />
            ) : (
              <ChevronDown size={18} className="text-muted" />
            )}
          </button>

          {showManual && (
            <div className="mt-4 space-y-4">
              <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Como obter os cookies:</p>
                <ol className="text-xs text-muted space-y-1.5 list-decimal list-inside">
                  <li>
                    Acesse{" "}
                    <a
                      href="https://sistema.appbarber.com.br"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      sistema.appbarber.com.br
                    </a>{" "}
                    e faça login na <strong>primeira loja</strong>
                  </li>
                  <li>
                    Pressione F12 → Aba <strong>Application</strong> →{" "}
                    <strong>Cookies</strong>
                  </li>
                  <li>
                    Copie o valor de <strong>PHPSESSID</strong>
                  </li>
                  <li>
                    Para a segunda loja, abra uma <strong>aba anônima</strong>,
                    logue, e copie o novo PHPSESSID
                  </li>
                </ol>
              </div>

              {manualStores.map((store, idx) => (
                <div
                  key={idx}
                  className="p-4 border border-card-border rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Loja {idx + 1}
                    </span>
                    {manualStores.length > 1 && (
                      <button
                        onClick={() =>
                          setManualStores((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-xs text-danger hover:underline"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={store.id}
                      onChange={(e) => {
                        const next = [...manualStores];
                        next[idx] = { ...next[idx], id: e.target.value };
                        setManualStores(next);
                      }}
                      placeholder="ID (ex: shopping)"
                      className="px-3 py-2 bg-background border border-card-border rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      value={store.name}
                      onChange={(e) => {
                        const next = [...manualStores];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setManualStores(next);
                      }}
                      placeholder="Nome (ex: Shopping Panorâmico)"
                      className="px-3 py-2 bg-background border border-card-border rounded-lg text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    value={store.phpSessionId}
                    onChange={(e) => {
                      const next = [...manualStores];
                      next[idx] = {
                        ...next[idx],
                        phpSessionId: e.target.value,
                      };
                      setManualStores(next);
                    }}
                    placeholder="PHPSESSID"
                    className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm font-mono"
                  />
                </div>
              ))}

              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setManualStores((prev) => [
                      ...prev,
                      { id: "", name: "", phpSessionId: "" },
                    ])
                  }
                  className="text-sm text-accent hover:underline"
                >
                  + Adicionar loja
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleManualSave}
                  disabled={
                    manualStatus === "saving" ||
                    !manualStores.some(
                      (s) => s.id && s.name && s.phpSessionId
                    )
                  }
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent text-sidebar-bg rounded-lg font-medium text-sm hover:bg-accent-light transition-colors disabled:opacity-50"
                >
                  {manualStatus === "saving" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  Salvar Cookies
                </button>

                {manualStatus === "saved" && (
                  <span className="text-success text-sm flex items-center gap-1">
                    <CheckCircle size={14} />
                    Salvo!
                  </span>
                )}
                {manualStatus === "error" && (
                  <span className="text-danger text-sm flex items-center gap-1">
                    <XCircle size={14} />
                    Erro ao salvar
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* --- Vercel Deploy Info --- */}
        <section className="bg-card-bg border border-card-border rounded-xl p-5 sm:p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <svg viewBox="0 0 76 65" className="w-4 h-4" fill="currentColor">
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
            Deploy na Vercel
          </h3>
          <p className="text-sm text-muted mb-3">
            Para funcionar na Vercel, siga estes passos:
          </p>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium mb-1.5">1. Criar um KV Store (Redis)</p>
              <p className="text-xs text-muted">
                No painel da Vercel → Storage → Create → KV (Redis) → Conecte ao projeto.
                As env vars <code className="text-accent">KV_REST_API_URL</code> e{" "}
                <code className="text-accent">KV_REST_API_TOKEN</code> são criadas automaticamente.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium mb-1.5">2. Variáveis de ambiente (opcionais)</p>
              <div className="bg-background rounded-lg p-3 font-mono text-xs space-y-1 border border-card-border">
                <p className="text-muted"># Credenciais para auto-login (opcional)</p>
                <p><span className="text-accent">APPBARBER_EMAIL</span>=seu-email</p>
                <p><span className="text-accent">APPBARBER_PASSWORD</span>=sua-senha</p>
                <p className="text-muted mt-2"># Proteger endpoint de keepalive</p>
                <p><span className="text-accent">CRON_SECRET</span>=token-aleatorio</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-1.5">3. Como funciona</p>
              <ul className="text-xs text-muted space-y-1 list-disc list-inside">
                <li>Login via página de config → sessões salvas no KV (Redis)</li>
                <li>Cron job a cada 10 min mantém sessões vivas</li>
                <li>Se sessão expirar → login manual ou automático via config</li>
                <li>Sem KV configurado, funciona com cache em memória (perde no cold start)</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
