// Portão de entrada do dashboard — senha compartilhada + cookie assinado (HMAC).
// Simples de propósito: dashboard interno, 1 senha pra todo mundo da equipe.
// Pra separar usuários depois, trocar por NextAuth/Clerk; mas por enquanto
// o objetivo é só impedir que a URL pública fique aberta pra qualquer um.

export const GATE_COOKIE = "cacique_gate";
const DEFAULT_TTL_DAYS = 365;

function getSecret(): string {
  const s = process.env.APP_AUTH_SECRET || process.env.APP_PASSWORD;
  if (!s) throw new Error("APP_AUTH_SECRET (ou APP_PASSWORD) não configurado");
  return s;
}

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return new Uint8Array(sig);
}

function timingSafeEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Cria um token `payload.sig` onde payload = {exp}. */
export async function assinarToken(ttlDias = DEFAULT_TTL_DAYS): Promise<string> {
  const exp = Date.now() + ttlDias * 24 * 60 * 60 * 1000;
  const payload = toB64Url(new TextEncoder().encode(JSON.stringify({ exp })));
  const sig = toB64Url(await hmac(getSecret(), payload));
  return `${payload}.${sig}`;
}

/** Verifica token. Retorna true se válido e não expirado. */
export async function verificarToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  let esperado: Uint8Array;
  try {
    esperado = await hmac(getSecret(), payload);
  } catch {
    return false;
  }
  let recebido: Uint8Array;
  try {
    recebido = fromB64Url(sig);
  } catch {
    return false;
  }
  if (!timingSafeEq(esperado, recebido)) return false;

  try {
    const { exp } = JSON.parse(new TextDecoder().decode(fromB64Url(payload)));
    if (typeof exp !== "number" || Date.now() > exp) return false;
    return true;
  } catch {
    return false;
  }
}

/** Compara senhas timing-safe. */
export function senhaCorreta(fornecida: string): boolean {
  const esperada = process.env.APP_PASSWORD;
  if (!esperada) return false;
  const a = new TextEncoder().encode(fornecida);
  const b = new TextEncoder().encode(esperada);
  return timingSafeEq(a, b);
}
