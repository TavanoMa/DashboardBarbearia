// @ts-check
/**
 * refresh-appbarber-sessions.mjs — o "robô" que conserta sessão caída.
 *
 * Só age quando precisa: confere cada loja e faz login apenas nas que NÃO
 * estão trazendo dados. Manter a sessão viva é trabalho do keepalive
 * (/api/cron/keepalive); este script é o plano B para quando o AppBarber
 * derruba a sessão de verdade.
 *
 * Por que um navegador? O login do AppBarber exige reCAPTCHA v3, e a chave é
 * travada no domínio sistema.appbarber.com.br. Só uma página aberta NAQUELE
 * domínio gera um token aceito. Então abrimos a tela de login num Chromium e
 * fazemos o login de dentro dela, como o site faz.
 *
 * Regra de ouro: um cookie novo só é gravado se comprovadamente traz dados da
 * loja. Se o login falhar, o cookie atual fica intacto.
 *
 * ATENÇÃO: o log do GitHub Actions é público. Nunca imprimir email, senha ou
 * pedaço de cookie aqui.
 *
 * Variáveis de ambiente (GitHub Secrets):
 *   APPBARBER_ACCOUNTS  JSON: [{ "email", "password", "stores": [{ "id", "name", "match"? }] }]
 *                       id/name = os mesmos cadastrados no dashboard.
 *                       match (opcional) = trecho do nome da loja como aparece no AppBarber.
 *   KV_REST_API_URL / KV_REST_API_TOKEN  (os mesmos do projeto na Vercel)
 *   FORCE_REFRESH=true  (opcional) refaz o login mesmo com a loja saudável — para testar.
 */

const BASE_URL = "https://sistema.appbarber.com.br";
const RECAPTCHA_SITE_KEY = "6LdVO78aAAAAAPCYO_iegSATfVfd9bEAX25U_czl";
const KV_SESSIONS_KEY = "appbarber:sessions";
const DASHBOARD_FIELDS = [
  "TotalComandaPendentes",
  "TotalRetorno",
  "TotalClienteNovo",
  "TotalContasReceber",
  "TotalContasPagar",
  "TotalUsuariosConectaramApp",
];

function log(...args) {
  console.log("[robo]", ...args);
}

/** Minúsculas, sem acento, só letras e números — para comparar nomes de loja. */
function norm(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function readAccounts() {
  let parsed;
  try {
    parsed = JSON.parse(process.env.APPBARBER_ACCOUNTS || "");
  } catch {
    throw new Error("APPBARBER_ACCOUNTS não é um JSON válido");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("APPBARBER_ACCOUNTS deve ser uma lista com ao menos 1 conta");
  }
  return parsed.map((a, i) => {
    const stores = Array.isArray(a.stores) ? a.stores.filter((s) => s && s.id && s.name) : [];
    if (!a.email || !a.password || stores.length === 0) {
      throw new Error(`conta #${i + 1}: faltam email, password ou stores[{id,name}]`);
    }
    return { label: `conta #${i + 1}`, email: String(a.email), password: String(a.password), stores };
  });
}

/**
 * Mesmo critério de src/lib/appbarber-auth.ts (probeSession): "active" só
 * quando a sessão está logada e ligada a uma loja.
 */
async function probe(phpSessionId) {
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
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return "dead";
    const text = await res.text();
    if (!text.trim() || text.includes("login") || text.includes("<html")) return "dead";
    const json = JSON.parse(text);
    if (!Array.isArray(json.data)) return "dead";
    const row = json.data[0];
    if (!row) return "alive";
    const real = DASHBOARD_FIELDS.some((k) => {
      const v = row[k];
      return v !== undefined && v !== null && v !== "" && v !== "0" && v !== 0;
    });
    return real ? "active" : "alive";
  } catch {
    return "dead";
  }
}

async function probeWithRetry(phpSessionId) {
  let status = await probe(phpSessionId);
  for (let i = 0; i < 2 && status !== "active"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    status = await probe(phpSessionId);
  }
  return status;
}

// ---------------------------------------------------------------------------
// Login de dentro da página do AppBarber
// ---------------------------------------------------------------------------

/**
 * Gera o token reCAPTCHA e chama /php/auth.php de dentro da página — mesma
 * origem, mesmos cookies, como o próprio site faz.
 * @param {import('playwright').Page} page
 */
async function authInPage(page, { email, password, establishmentCode }) {
  return page.evaluate(
    async ({ siteKey, email, password, establishmentCode }) => {
      const token = await new Promise((resolve, reject) => {
        // @ts-ignore — grecaptcha é carregado pela página do AppBarber
        const g = window.grecaptcha;
        if (!g) return reject(new Error("reCAPTCHA não carregou na página"));
        g.ready(() => g.execute(siteKey, { action: "submit" }).then(resolve, reject));
      });
      const body = new URLSearchParams();
      body.append("login", email);
      body.append("senha", password);
      body.append("origem", "sistema.appbarber.com.br");
      if (establishmentCode) body.append("establishment_code", establishmentCode);
      body.append("token", String(token));
      body.append("showOrNotShowInfoDates", "true");
      const res = await fetch("/php/auth.php", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json, */*",
        },
        body: body.toString(),
        credentials: "same-origin",
      });
      try {
        return await res.json();
      } catch {
        return null;
      }
    },
    { siteKey: RECAPTCHA_SITE_KEY, email, password, establishmentCode: establishmentCode || "" }
  );
}

function pickEstablishment(establishments, store, soleStore) {
  const wanted = [store.match, store.name, store.id].map(norm).filter(Boolean);
  const found = establishments.find((e) => {
    const name = norm(e.name);
    return wanted.some((w) => name === w || name.includes(w) || w.includes(name));
  });
  if (found) return found;
  // Conta com uma única loja e um único estabelecimento: não há o que errar.
  if (establishments.length === 1 && soleStore) return establishments[0];
  return null;
}

/**
 * Faz o login de UMA loja num contexto de navegador novo (cookies separados),
 * para cada loja ter a própria sessão. Devolve o PHPSESSID ou lança.
 * @param {import('playwright').Browser} browser
 */
async function loginStore(browser, account, store) {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1366, height: 768 },
  });
  try {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/login.php`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => !!window["grecaptcha"], undefined, { timeout: 30000 });
    // O reCAPTCHA v3 pontua o comportamento na página; um pouco de atividade ajuda.
    await page.mouse.move(300, 300, { steps: 12 });
    await page.waitForTimeout(2500);
    await page.mouse.move(640, 420, { steps: 18 });

    let data = await authInPage(page, account);
    if (!data) throw new Error("o AppBarber não devolveu JSON no login");

    if (data.error && data.error_action_code === 1) {
      throw new Error(`login recusado: ${data.auth?.[0]?.result || "sem detalhe"}`);
    }

    if (data.error && data.error_action_code === 2) {
      const establishments = (Array.isArray(data.auth) ? data.auth : [])
        .filter((a) => a.establishment_code && a.establishment_name)
        .map((a) => ({ code: String(a.establishment_code), name: String(a.establishment_name) }));
      const match = pickEstablishment(establishments, store, account.stores.length === 1);
      if (!match) {
        throw new Error(
          `não achei "${store.name}" entre as lojas da conta: ${establishments.map((e) => e.name).join(" | ")}` +
            ` — ajuste o campo "match" no APPBARBER_ACCOUNTS`
        );
      }
      await page.waitForTimeout(1200);
      data = await authInPage(page, { ...account, establishmentCode: match.code });
      if (!data) throw new Error("o AppBarber não devolveu JSON ao escolher a loja");
      if (data.error) {
        throw new Error(`falha ao escolher a loja: ${data.auth?.[0]?.result || `código ${data.error_action_code}`}`);
      }
      return await sessionCookie(context, match.code);
    }

    if (data.error) {
      throw new Error(`login falhou: ${data.auth?.[0]?.result || `código ${data.error_action_code}`}`);
    }
    return await sessionCookie(context, undefined);
  } finally {
    // Fecha sem "Sair": a sessão continua valendo no servidor do AppBarber.
    await context.close();
  }
}

/** @param {import('playwright').BrowserContext} context */
async function sessionCookie(context, establishmentCode) {
  const cookies = await context.cookies(BASE_URL);
  const php = cookies.find((c) => c.name === "PHPSESSID");
  if (!php?.value) throw new Error("login sem erro, mas sem cookie PHPSESSID");
  return { phpSessionId: php.value, establishmentCode };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.APPBARBER_ACCOUNTS || !process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    log("robô desligado: faltam os secrets APPBARBER_ACCOUNTS / KV_REST_API_URL / KV_REST_API_TOKEN.");
    return;
  }
  const force = process.env.FORCE_REFRESH === "true";
  const accounts = readAccounts();
  const { kv } = await import("@vercel/kv");

  // Se a leitura falhar, kv.get lança e paramos aqui — nunca gravar por cima sem ter lido.
  const existing = /** @type {any[]} */ ((await kv.get(KV_SESSIONS_KEY)) || []);

  // 1. Quais lojas precisam de conserto?
  const jobs = [];
  for (const account of accounts) {
    for (const store of account.stores) {
      const current = existing.find((s) => s.id === store.id);
      const status = current?.phpSessionId ? await probeWithRetry(current.phpSessionId) : "dead";
      log(`${store.id}: ${status}${status === "active" && force ? " (forçando novo login)" : ""}`);
      if (status !== "active" || force) jobs.push({ account, store });
    }
  }

  if (jobs.length === 0) {
    log("todas as lojas estão trazendo dados — nada a fazer.");
    return;
  }

  // 2. Login só nas que precisam
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const healed = [];
  const failed = [];
  try {
    for (const { account, store } of jobs) {
      try {
        const session = await loginStore(browser, account, store);
        const status = await probeWithRetry(session.phpSessionId);
        if (status !== "active") {
          throw new Error(`o login passou, mas a sessão nova não traz dados (${status})`);
        }
        healed.push({ store, session });
        log(`${store.id}: login novo OK`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push(`${store.id} (${account.label}): ${msg}`);
        log(`${store.id}: NÃO consertou — ${msg}`);
      }
    }
  } finally {
    await browser.close();
  }

  // 3. Grava só o que foi comprovado, em cima do estado mais recente do KV
  if (healed.length > 0) {
    const latest = /** @type {any[]} */ ((await kv.get(KV_SESSIONS_KEY)) || []);
    const now = Date.now();
    for (const { store, session } of healed) {
      const fresh = {
        id: store.id,
        name: store.name,
        phpSessionId: session.phpSessionId,
        appblzId: "",
        ...(session.establishmentCode ? { establishmentCode: session.establishmentCode } : {}),
        lastVerified: now,
        lastStatus: "active",
        statusSince: now,
      };
      const idx = latest.findIndex((s) => s.id === store.id);
      if (idx === -1) latest.push(fresh);
      else latest[idx] = { ...latest[idx], ...fresh };
    }
    await kv.set(KV_SESSIONS_KEY, latest);
    log(`gravado no KV: ${healed.map((h) => h.store.id).join(", ")}`);
  }

  if (failed.length > 0) {
    for (const f of failed) console.log(`::error::Sessão não consertada — ${f}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.log(`::error::Robô falhou — ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
