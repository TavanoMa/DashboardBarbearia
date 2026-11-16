import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const BASE_URL = "https://sistema.appbarber.com.br";
const CONFIG_PATH = join(process.cwd(), ".appbarber.json");

// KV keys
const KV_SESSIONS_KEY = "appbarber:sessions";
const KV_CREDENTIALS_KEY = "appbarber:credentials";
const KV_KEEPALIVE_LOG_KEY = "appbarber:keepalive-log";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Establishment {
  code: string;
  name: string;
}

export type SessionStatus = "active" | "alive" | "dead";

export interface StoreSessions {
  id: string;
  name: string;
  phpSessionId: string;
  appblzId: string;
  establishmentCode?: string; // AppBarber establishment code for re-auth
  lastVerified?: number; // timestamp
  lastStatus?: SessionStatus; // resultado do último keepalive
  statusSince?: number; // desde quando está em lastStatus
}

export interface CredentialSet {
  email: string;
  password: string;
  storeIds: string[]; // which stores this credential authenticates
}

export interface KeepAliveLogEntry {
  timestamp: string;
  stores: Array<{
    id: string;
    name: string;
    status: SessionStatus;
    prevStatus?: SessionStatus;
    changed: boolean;
    reauthed?: boolean; // só em entradas antigas (a re-autenticação automática foi removida)
    reason?: string; // por que não está "active"
  }>;
}

interface ConfigFile {
  credentials?: {
    email: string;
    password: string;
  };
  stores: StoreSessions[];
}

interface AuthResponse {
  error: boolean;
  error_action_code?: number;
  auth: Array<{
    error?: string;
    result?: string;
    establishment_code?: string;
    establishment_name?: string;
    user_id?: string;
  }>;
}

// ---------------------------------------------------------------------------
// In-memory session cache (survives across requests in warm serverless fns)
// ---------------------------------------------------------------------------

let sessionCache: StoreSessions[] = [];
let cacheTimestamp = 0;
// Curto de propósito: cada instância serverless tem a própria cópia. Com 30 min,
// uma instância continuava servindo (e regravando) o cookie antigo depois que
// outra salvava um novo.
const CACHE_TTL = 60 * 1000; // 1 minuto

// ---------------------------------------------------------------------------
// Storage layer — Vercel KV (production) or file (local dev)
// ---------------------------------------------------------------------------

/**
 * Detect if Vercel KV is configured (env vars KV_REST_API_URL + KV_REST_API_TOKEN).
 */
function isKvAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/**
 * Lazy-load @vercel/kv only when available to avoid errors in local dev.
 */
async function getKv() {
  if (!isKvAvailable()) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return kv;
  } catch {
    return null;
  }
}

// --- KV operations ---

async function kvGet<T>(key: string): Promise<T | null> {
  const kv = await getKv();
  if (!kv) return null;
  try {
    return await kv.get<T>(key);
  } catch {
    return null;
  }
}

/**
 * Igual a kvGet, mas NÃO engole erro: se o KV está configurado e a leitura
 * falha, lança. Usado onde "não consegui ler" não pode virar "não tem nada"
 * (senão uma falha passageira do KV apagaria as lojas ao regravar).
 */
async function kvGetStrict<T>(key: string): Promise<T | null> {
  if (!isKvAvailable()) return null;
  const { kv } = await import("@vercel/kv");
  return await kv.get<T>(key);
}

async function kvSet<T>(key: string, value: T): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  try {
    await kv.set(key, value);
  } catch {
    // ignore
  }
}

// --- File operations (local dev) ---

function loadConfigFile(): ConfigFile {
  if (!existsSync(CONFIG_PATH)) return { stores: [] };
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    if (raw.stores && Array.isArray(raw.stores)) {
      return { credentials: raw.credentials || undefined, stores: raw.stores };
    }
    if (raw.phpSessionId) {
      return {
        stores: [{
          id: "default",
          name: "Loja Padrão",
          phpSessionId: raw.phpSessionId,
          appblzId: raw.appblzId || "",
        }],
      };
    }
    return { stores: [] };
  } catch {
    return { stores: [] };
  }
}

function saveConfigFile(config: ConfigFile) {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch {
    // Read-only filesystem (Vercel) — ignore
  }
}

// ---------------------------------------------------------------------------
// Credentials (multi-account support)
// ---------------------------------------------------------------------------

/**
 * Get ALL credential sets.  Priority:
 *   1. APPBARBER_CREDENTIALS env var (JSON array)
 *   2. APPBARBER_EMAIL + APPBARBER_PASSWORD env vars (single, backward compat)
 *   3. Vercel KV
 *   4. Config file (local dev)
 */
export async function getAllCredentials(): Promise<CredentialSet[]> {
  // 1. JSON env var (supports multiple accounts)
  if (process.env.APPBARBER_CREDENTIALS) {
    try {
      const parsed = JSON.parse(process.env.APPBARBER_CREDENTIALS);
      if (Array.isArray(parsed)) {
        return parsed.map((c: Record<string, unknown>) => ({
          email: String(c.email || ""),
          password: String(c.password || ""),
          storeIds: Array.isArray(c.storeIds) ? c.storeIds as string[] : [],
        })).filter(c => c.email && c.password);
      }
    } catch { /* ignore parse errors */ }
  }

  // 2. Single env var (backward compat)
  if (process.env.APPBARBER_EMAIL && process.env.APPBARBER_PASSWORD) {
    return [{
      email: process.env.APPBARBER_EMAIL,
      password: process.env.APPBARBER_PASSWORD,
      storeIds: [],
    }];
  }

  // 3. Vercel KV
  const kvCreds = await kvGet<CredentialSet[] | { email: string; password: string }>(KV_CREDENTIALS_KEY);
  if (kvCreds) {
    if (Array.isArray(kvCreds) && kvCreds.length > 0) {
      return kvCreds;
    }
    // Backward compat: old single-credential format
    if ("email" in kvCreds && kvCreds.email) {
      return [{ email: kvCreds.email, password: kvCreds.password, storeIds: [] }];
    }
  }

  // 4. Config file (local dev)
  const config = loadConfigFile();
  if (config.credentials) {
    return [{ email: config.credentials.email, password: config.credentials.password, storeIds: [] }];
  }

  return [];
}

/**
 * Backward-compat helper: returns the first credential set found.
 */
export async function getCredentials(): Promise<{ email: string; password: string } | null> {
  const all = await getAllCredentials();
  return all.length > 0 ? { email: all[0].email, password: all[0].password } : null;
}

/**
 * Save credentials for specific stores. Merges with existing credentials
 * (replaces entry for the same email, adds new ones).
 */
export async function saveCredentials(email: string, password: string, storeIds: string[] = []) {
  // Load existing from KV
  let allCreds: CredentialSet[] = [];
  const kvCreds = await kvGet<CredentialSet[] | { email: string; password: string }>(KV_CREDENTIALS_KEY);
  if (kvCreds) {
    if (Array.isArray(kvCreds)) {
      allCreds = kvCreds;
    } else if ("email" in kvCreds && kvCreds.email) {
      allCreds = [{ email: kvCreds.email, password: kvCreds.password, storeIds: [] }];
    }
  }

  // Remove existing entry for same email (will re-add with updated storeIds)
  allCreds = allCreds.filter(c => c.email !== email);

  // Add updated entry
  allCreds.push({ email, password, storeIds });

  // Save to KV (Vercel)
  await kvSet(KV_CREDENTIALS_KEY, allCreds);

  // Save to file (local dev — last credential for backward compat)
  const config = loadConfigFile();
  config.credentials = { email, password };
  saveConfigFile(config);
}

// ---------------------------------------------------------------------------
// Auth with AppBarber
// ---------------------------------------------------------------------------

export async function discoverEstablishments(
  email: string,
  password: string,
  recaptchaToken: string
): Promise<{
  success: boolean;
  establishments?: Establishment[];
  singleSession?: { phpSessionId: string };
  error?: string;
}> {
  try {
    const body = new URLSearchParams();
    body.append("login", email);
    body.append("senha", password);
    body.append("origem", "sistema.appbarber.com.br");
    body.append("token", recaptchaToken);
    body.append("showOrNotShowInfoDates", "true");

    const res = await fetch(`${BASE_URL}/php/auth.php`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json, */*",
        origin: BASE_URL,
        referer: `${BASE_URL}/login.php`,
      },
      body: body.toString(),
    });

    const setCookie = res.headers.get("set-cookie") || "";
    const phpSessionId = extractPhpSessionId(setCookie);
    const data = (await res.json()) as AuthResponse;

    if (data.error && data.error_action_code === 2) {
      const establishments = data.auth
        .filter((a) => a.establishment_code && a.establishment_name)
        .map((a) => ({ code: a.establishment_code!, name: a.establishment_name! }));
      return { success: true, establishments };
    }

    if (data.error && data.error_action_code === 1) {
      return { success: false, error: data.auth[0]?.result || "Erro de autenticação" };
    }

    // Só é login de verdade se o AppBarber NÃO devolveu erro. O PHP manda um
    // PHPSESSID novo em qualquer resposta, inclusive quando o login falha —
    // aceitar esse cookie era gravar uma sessão anônima (vazia) como se fosse boa.
    if (!data.error && phpSessionId) {
      return { success: true, singleSession: { phpSessionId } };
    }

    return { success: false, error: data.auth?.[0]?.result || "Resposta inesperada do AppBarber" };
  } catch (err) {
    return { success: false, error: `Erro de conexão: ${err}` };
  }
}

export async function authenticateEstablishment(
  email: string,
  password: string,
  establishmentCode: string,
  recaptchaToken: string
): Promise<{ success: boolean; phpSessionId?: string; error?: string }> {
  try {
    const body = new URLSearchParams();
    body.append("login", email);
    body.append("senha", password);
    body.append("origem", "sistema.appbarber.com.br");
    body.append("establishment_code", establishmentCode);
    body.append("token", recaptchaToken);
    body.append("showOrNotShowInfoDates", "true");

    const res = await fetch(`${BASE_URL}/php/auth.php`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json, */*",
        origin: BASE_URL,
        referer: `${BASE_URL}/login.php`,
      },
      body: body.toString(),
    });

    const setCookie = res.headers.get("set-cookie") || "";
    const phpSessionId = extractPhpSessionId(setCookie);
    const data = (await res.json()) as AuthResponse;

    if (!data.error && phpSessionId) {
      return { success: true, phpSessionId };
    }

    // Resposta com erro: só aceita o cookie se ele comprovadamente traz dados
    // da loja. Uma sessão anônima também responde 200, então "respondeu" não basta.
    if (phpSessionId && (await testSession(phpSessionId)) === "active") {
      return { success: true, phpSessionId };
    }

    return { success: false, error: data.auth?.[0]?.result || "Falha ao autenticar na loja" };
  } catch (err) {
    return { success: false, error: `Erro de conexão: ${err}` };
  }
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/**
 * Store sessions to KV (Vercel) + file (local) + memory cache.
 * Replaces ALL sessions — use mergeAndSaveSessions() to keep existing ones.
 */
export async function saveSessions(stores: StoreSessions[]) {
  // Memory cache
  sessionCache = stores;
  cacheTimestamp = Date.now();

  // Vercel KV
  await kvSet(KV_SESSIONS_KEY, stores);

  // Local file
  const config = loadConfigFile();
  config.stores = stores;
  saveConfigFile(config);
}

/**
 * Merge new sessions with existing ones (from other logins) and save.
 * New sessions overwrite existing ones with the same store id.
 */
export async function mergeAndSaveSessions(
  newSessions: StoreSessions[],
  credentials?: { email: string; password: string; storeIds?: string[] }
) {
  // Load existing sessions — direto do KV, para não regravar por cima das
  // outras lojas um cookie velho que estava no cache desta instância
  const existing = await loadSessionsFresh();

  // Remove existing sessions for stores being re-authenticated
  const newIds = new Set(newSessions.map(s => s.id));
  const kept = existing.filter(s => !newIds.has(s.id));

  // Merge: kept existing + new
  const merged = [...kept, ...newSessions];

  // Save merged sessions
  await saveSessions(merged);

  // Save credentials if provided
  if (credentials) {
    await saveCredentials(
      credentials.email,
      credentials.password,
      credentials.storeIds || newSessions.map(s => s.id)
    );
  }
}

/**
 * Lê as sessões direto da fonte (KV em produção, arquivo em dev), ignorando o
 * cache em memória. Lança se o KV estiver configurado e a leitura falhar —
 * quem vai regravar a lista precisa saber que não leu, em vez de receber [].
 */
export async function loadSessionsFresh(): Promise<StoreSessions[]> {
  if (isKvAvailable()) {
    const kvSessions = await kvGetStrict<StoreSessions[]>(KV_SESSIONS_KEY);
    const list = Array.isArray(kvSessions) ? kvSessions : [];
    sessionCache = list;
    cacheTimestamp = Date.now();
    return list;
  }
  return loadConfigFile().stores;
}

/**
 * Get active sessions: memory → KV → file.
 */
export async function getActiveSessions(): Promise<StoreSessions[]> {
  // 1. Memory cache
  if (sessionCache.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
    return sessionCache;
  }

  // 2. Vercel KV
  const kvSessions = await kvGet<StoreSessions[]>(KV_SESSIONS_KEY);
  if (kvSessions && kvSessions.length > 0) {
    sessionCache = kvSessions;
    cacheTimestamp = Date.now();
    return kvSessions;
  }

  // 3. Config file (local dev)
  const config = loadConfigFile();
  if (config.stores.length > 0) {
    sessionCache = config.stores;
    cacheTimestamp = Date.now();
    return config.stores;
  }

  return [];
}

/**
 * Synchronous version for hot path (uses only memory cache + file).
 * Use getActiveSessions() when async is ok (it checks KV too).
 */
export function getActiveSessionsSync(): StoreSessions[] {
  if (sessionCache.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
    return sessionCache;
  }
  const config = loadConfigFile();
  if (config.stores.length > 0) {
    sessionCache = config.stores;
    cacheTimestamp = Date.now();
    return config.stores;
  }
  return [];
}

const PROBE_TIMEOUT_MS = 8000;

/**
 * Campos do painel do AppBarber que só vêm preenchidos quando a sessão está
 * logada E ligada a uma loja. Numa sessão anônima eles vêm vazios/zerados.
 */
const DASHBOARD_FIELDS = [
  "TotalComandaPendentes",
  "TotalRetorno",
  "TotalClienteNovo",
  "TotalContasReceber",
  "TotalContasPagar",
  "TotalUsuariosConectaramApp",
];

/**
 * Testa uma sessão e diz POR QUE ela não está boa.
 *   active = logada e ligada à loja (traz dados)
 *   alive  = o AppBarber responde, mas a sessão não está ligada a loja nenhuma
 *   dead   = sem resposta útil (AppBarber fora do ar, erro HTTP, tela de login)
 *
 * "dead" nem sempre é sessão morta: uma queda momentânea do AppBarber dá o
 * mesmo resultado. Por isso ninguém pode trocar cookie com base nele.
 */
export async function probeSession(
  phpSessionId: string
): Promise<{ status: SessionStatus; reason?: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/pages/relatorios/buscaRelDashboard.php`, {
      method: "POST",
      headers: {
        accept: "application/json, */*",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        origin: BASE_URL,
        referer: `${BASE_URL}/index.php`,
        "x-requested-with": "XMLHttpRequest",
        cookie: `PHPSESSID=${phpSessionId}`,
      },
      body: "",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch (err) {
    const tipo = err instanceof Error ? err.name : "erro";
    return { status: "dead", reason: `sem resposta do AppBarber (${tipo})` };
  }

  if (!res.ok) return { status: "dead", reason: `AppBarber respondeu HTTP ${res.status}` };

  let text: string;
  try {
    text = await res.text();
  } catch {
    return { status: "dead", reason: "resposta interrompida" };
  }

  if (!text.trim()) return { status: "dead", reason: "resposta vazia" };
  if (text.includes("login") || text.includes("<html")) {
    return { status: "dead", reason: "AppBarber devolveu a tela de login" };
  }

  let json: { data?: unknown };
  try {
    json = JSON.parse(text);
  } catch {
    return { status: "dead", reason: "resposta não é JSON" };
  }
  if (!json.data || !Array.isArray(json.data)) {
    return { status: "dead", reason: "JSON sem a lista de dados" };
  }

  const row = json.data[0] as Record<string, unknown> | undefined;
  if (!row) return { status: "alive", reason: "sessão sem loja (lista vazia)" };

  const hasRealData = DASHBOARD_FIELDS.some((key) => {
    const val = row[key];
    return val !== undefined && val !== null && val !== "" && val !== "0" && val !== 0;
  });

  return hasRealData
    ? { status: "active" }
    : { status: "alive", reason: "sessão sem loja (contadores zerados)" };
}

/**
 * Test if a session is still valid and bound to an establishment.
 * Returns "active" if the session has real data, "alive" if the session
 * responds but with empty/unbound data, or "dead" if the session is expired.
 */
export async function testSession(phpSessionId: string): Promise<SessionStatus> {
  return (await probeSession(phpSessionId)).status;
}

/**
 * Backward-compat wrapper for code that just needs a boolean.
 */
export async function isSessionAlive(phpSessionId: string): Promise<boolean> {
  const status = await testSession(phpSessionId);
  return status !== "dead";
}

/** Repete o teste antes de concluir que a sessão não está boa (evita alarme falso). */
async function probeSessionWithRetry(phpSessionId: string, attempts = 3) {
  let last = await probeSession(phpSessionId);
  for (let i = 1; i < attempts && last.status !== "active"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    last = await probeSession(phpSessionId);
  }
  return last;
}

export interface KeepAliveResult {
  id: string;
  name: string;
  alive: boolean;
  status: SessionStatus;
  prevStatus?: SessionStatus;
  changed: boolean;
  /** Desde quando a loja está neste status (ms). */
  statusSince: number;
  reason?: string;
}

// lastVerified é só informativo; regravar a cada ping gastaria KV à toa.
const VERIFIED_WRITE_INTERVAL = 30 * 60 * 1000;

/**
 * Keepalive: faz uma requisição com cada cookie (é isso que impede o AppBarber
 * de expirar a sessão por inatividade) e registra o status.
 *
 * O que ele NÃO faz, de propósito: tentar logar de novo ou trocar o cookie.
 * O login do AppBarber exige reCAPTCHA, então a "re-autenticação automática"
 * que existia aqui nunca conseguia logar — mas a cada tentativa recebia um
 * PHPSESSID anônimo e gravava por cima do cookie bom. Uma falha passageira de
 * rede virava perda definitiva da sessão. Quem troca cookie agora é só o login
 * manual (/configuracoes) ou o robô (scripts/refresh-appbarber-sessions.mjs).
 */
export async function keepAliveSessions(): Promise<KeepAliveResult[]> {
  // Direto do KV, nunca do cache em memória: uma instância com cache velho
  // testaria (e depois regravaria) cookies que já foram substituídos.
  const sessions = await loadSessionsFresh();
  if (sessions.length === 0) return [];

  const probes = await Promise.all(sessions.map((s) => probeSessionWithRetry(s.phpSessionId)));
  const now = Date.now();

  const results: KeepAliveResult[] = sessions.map((s, i) => {
    const { status, reason } = probes[i];
    const changed = s.lastStatus !== status;
    return {
      id: s.id,
      name: s.name,
      alive: status !== "dead",
      status,
      prevStatus: s.lastStatus,
      changed,
      statusSince: changed ? now : s.statusSince ?? now,
      reason,
    };
  });

  const anyChanged = results.some((r) => r.changed);
  const verifiedStale = sessions.some(
    (s, i) => results[i].alive && now - (s.lastVerified ?? 0) > VERIFIED_WRITE_INTERVAL
  );

  if (anyChanged || verifiedStale) {
    // Relê antes de gravar e só atualiza a loja cujo cookie é o mesmo que foi
    // testado. Se alguém salvou um cookie novo nesse meio-tempo, ele fica intacto.
    const current = await loadSessionsFresh();
    const patched = current.map((c) => {
      const idx = sessions.findIndex((s) => s.id === c.id && s.phpSessionId === c.phpSessionId);
      if (idx === -1) return c;
      const r = results[idx];
      return {
        ...c,
        lastStatus: r.status,
        statusSince: r.statusSince,
        lastVerified: r.alive ? now : c.lastVerified,
      };
    });
    await saveSessions(patched);
  }

  if (anyChanged) {
    try {
      const prevLog = (await kvGetStrict<KeepAliveLogEntry[]>(KV_KEEPALIVE_LOG_KEY)) || [];
      const entry: KeepAliveLogEntry = {
        timestamp: new Date(now).toISOString(),
        stores: results.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          prevStatus: r.prevStatus,
          changed: r.changed,
          ...(r.reason ? { reason: r.reason } : {}),
        })),
      };
      await kvSet(KV_KEEPALIVE_LOG_KEY, [...prevLog.slice(-99), entry]);
    } catch (err) {
      console.error("[keepalive] não consegui gravar o histórico:", err);
    }
  }

  return results;
}

/**
 * Get keepalive log history for diagnostics.
 */
export async function getKeepAliveLog(): Promise<KeepAliveLogEntry[]> {
  return await kvGet<KeepAliveLogEntry[]>(KV_KEEPALIVE_LOG_KEY) || [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractPhpSessionId(setCookieHeader: string): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/PHPSESSID=([^;]+)/);
  return match ? match[1] : null;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}
