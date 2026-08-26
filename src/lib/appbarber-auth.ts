import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const BASE_URL = "https://sistema.appbarber.com.br";
const CONFIG_PATH = join(process.cwd(), ".appbarber.json");

// KV keys
const KV_SESSIONS_KEY = "appbarber:sessions";
const KV_CREDENTIALS_KEY = "appbarber:credentials";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Establishment {
  code: string;
  name: string;
}

export interface StoreSessions {
  id: string;
  name: string;
  phpSessionId: string;
  appblzId: string;
  lastVerified?: number; // timestamp
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
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

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
// Credentials
// ---------------------------------------------------------------------------

export async function getCredentials(): Promise<{ email: string; password: string } | null> {
  // Env vars (highest priority)
  if (process.env.APPBARBER_EMAIL && process.env.APPBARBER_PASSWORD) {
    return { email: process.env.APPBARBER_EMAIL, password: process.env.APPBARBER_PASSWORD };
  }
  // Vercel KV
  const kvCreds = await kvGet<{ email: string; password: string }>(KV_CREDENTIALS_KEY);
  if (kvCreds) return kvCreds;
  // Config file (local dev)
  const config = loadConfigFile();
  return config.credentials || null;
}

export async function saveCredentials(email: string, password: string) {
  // Save to KV (Vercel)
  await kvSet(KV_CREDENTIALS_KEY, { email, password });
  // Save to file (local dev)
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

    if (phpSessionId) {
      return { success: true, singleSession: { phpSessionId } };
    }

    return { success: false, error: "Resposta inesperada do AppBarber" };
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

    if (phpSessionId) {
      const testRes = await fetch(`${BASE_URL}/pages/relatorios/buscaRelDashboard.php`, {
        method: "POST",
        headers: {
          accept: "application/json, */*",
          "content-type": "application/x-www-form-urlencoded",
          origin: BASE_URL,
          referer: `${BASE_URL}/index.php`,
          "x-requested-with": "XMLHttpRequest",
          cookie: `PHPSESSID=${phpSessionId}`,
        },
        body: "",
      });
      if (testRes.ok) {
        return { success: true, phpSessionId };
      }
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
 */
export async function saveSessions(
  stores: StoreSessions[],
  credentials?: { email: string; password: string }
) {
  // Memory cache
  sessionCache = stores;
  cacheTimestamp = Date.now();

  // Vercel KV
  await kvSet(KV_SESSIONS_KEY, stores);
  if (credentials) {
    await kvSet(KV_CREDENTIALS_KEY, credentials);
  }

  // Local file
  const config = loadConfigFile();
  config.stores = stores;
  if (credentials) config.credentials = credentials;
  saveConfigFile(config);
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

/**
 * Test if a session is still valid.
 */
export async function testSession(phpSessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/pages/relatorios/buscaRelDashboard.php`, {
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
    });

    if (!res.ok) return false;
    const text = await res.text();
    if (text.includes("login") || text.includes("<html") || !text.trim()) return false;
    try {
      const json = JSON.parse(text);
      return json.data && Array.isArray(json.data);
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Keepalive: ping all sessions + persist updated timestamps.
 */
export async function keepAliveSessions(): Promise<
  Array<{ id: string; name: string; alive: boolean }>
> {
  const sessions = await getActiveSessions();
  if (sessions.length === 0) return [];

  const results = await Promise.all(
    sessions.map(async (store) => {
      const alive = await testSession(store.phpSessionId);
      return { id: store.id, name: store.name, alive };
    })
  );

  const updatedSessions = sessions.map((s) => {
    const result = results.find((r) => r.id === s.id);
    return result?.alive ? { ...s, lastVerified: Date.now() } : s;
  });

  // Persist everywhere
  sessionCache = updatedSessions;
  cacheTimestamp = Date.now();
  await kvSet(KV_SESSIONS_KEY, updatedSessions);
  try {
    const config = loadConfigFile();
    config.stores = updatedSessions;
    saveConfigFile(config);
  } catch { /* ignore on Vercel */ }

  return results;
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
