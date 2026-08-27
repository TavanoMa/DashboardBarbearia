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

export interface CredentialSet {
  email: string;
  password: string;
  storeIds: string[]; // which stores this credential authenticates
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
  // Load existing sessions
  const existing = await getActiveSessions();

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
 * Test if a session is still valid and bound to an establishment.
 * Returns "active" if the session has real data, "alive" if the session
 * responds but with empty/unbound data, or "dead" if the session is expired.
 */
export async function testSession(phpSessionId: string): Promise<"active" | "alive" | "dead"> {
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

    if (!res.ok) return "dead";
    const text = await res.text();
    if (text.includes("login") || text.includes("<html") || !text.trim()) return "dead";
    try {
      const json = JSON.parse(text);
      if (!json.data || !Array.isArray(json.data)) return "dead";

      // Check if the data is meaningful (has real dashboard values)
      // An unbound session returns data with all fields empty/zero
      const row = json.data[0] as Record<string, string> | undefined;
      if (!row) return "alive"; // Empty data array — session exists but no dashboard data

      // If key dashboard fields are all empty/zero, the session is probably unbound
      const hasRealData = Object.entries(row).some(([key, val]) => {
        if (key === "TotalComandaPendentes" || key === "TotalRetorno" ||
            key === "TotalClienteNovo" || key === "TotalContasReceber" ||
            key === "TotalContasPagar" || key === "TotalUsuariosConectaramApp") {
          return val !== "" && val !== "0" && val !== undefined;
        }
        return false;
      });

      return hasRealData ? "active" : "alive";
    } catch {
      return "dead";
    }
  } catch {
    return "dead";
  }
}

/**
 * Backward-compat wrapper for code that just needs a boolean.
 */
export async function isSessionAlive(phpSessionId: string): Promise<boolean> {
  const status = await testSession(phpSessionId);
  return status !== "dead";
}

/**
 * Keepalive: ping all sessions + persist updated timestamps.
 */
export async function keepAliveSessions(): Promise<
  Array<{ id: string; name: string; alive: boolean; status: "active" | "alive" | "dead" }>
> {
  const sessions = await getActiveSessions();
  if (sessions.length === 0) return [];

  const results = await Promise.all(
    sessions.map(async (store) => {
      const status = await testSession(store.phpSessionId);
      return { id: store.id, name: store.name, alive: status !== "dead", status };
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
