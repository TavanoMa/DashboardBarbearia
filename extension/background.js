// Background service worker — escuta mudanças no cookie PHPSESSID do AppBarber
// e envia pro dashboard sempre que o cookie troca (= login novo ou renovação).
//
// Config fica em chrome.storage.local:
//   - dashboardUrl: URL base do dashboard (ex.: https://dashboard-two-teal-35.vercel.app)
//   - syncToken:    token compartilhado com o backend
//   - storeId:      qual loja esta instância do Chrome está usando
//   - autoSync:     true/false (padrão: true)

const APPBARBER_HOST = "sistema.appbarber.com.br";
const COOKIE_NAME = "PHPSESSID";
const DEBOUNCE_MS = 3000;
let debounceHandle = null;

// ---------------------------------------------------------------------------

async function getConfig() {
  return await chrome.storage.local.get([
    "dashboardUrl",
    "syncToken",
    "storeId",
    "autoSync",
  ]);
}

async function setStatus(status) {
  const now = new Date().toISOString();
  await chrome.storage.local.set({
    lastStatus: status,
    lastStatusAt: now,
  });
  // Mostra um "badge" curto no ícone pra feedback visual
  const text =
    status.type === "ok"
      ? "OK"
      : status.type === "warn"
      ? "!"
      : status.type === "error"
      ? "X"
      : "";
  const color =
    status.type === "ok"
      ? "#10b981"
      : status.type === "warn"
      ? "#f59e0b"
      : "#ef4444";
  try {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 8000);
  } catch {}
}

async function readPhpSessionCookie() {
  const cookie = await chrome.cookies.get({
    url: `https://${APPBARBER_HOST}/`,
    name: COOKIE_NAME,
  });
  return cookie ? cookie.value : null;
}

async function syncNow(trigger) {
  const { dashboardUrl, syncToken, storeId, autoSync } = await getConfig();
  if (autoSync === false && trigger !== "manual") {
    await setStatus({
      type: "warn",
      message: "Sincronização automática desligada",
    });
    return { ok: false, reason: "autoSyncOff" };
  }
  if (!dashboardUrl || !syncToken || !storeId) {
    await setStatus({
      type: "warn",
      message: "Falta configurar URL, token ou loja",
    });
    return { ok: false, reason: "notConfigured" };
  }

  const phpSessionId = await readPhpSessionCookie();
  if (!phpSessionId) {
    await setStatus({
      type: "warn",
      message: "Nenhum cookie do AppBarber. Faça login no sistema.appbarber.com.br.",
    });
    return { ok: false, reason: "noCookie" };
  }

  try {
    const res = await fetch(`${dashboardUrl.replace(/\/$/, "")}/api/auth/sync-cookie`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sync-token": syncToken,
      },
      body: JSON.stringify({ storeId, phpSessionId, source: trigger || "auto" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await setStatus({
        type: "error",
        message: data.error || `HTTP ${res.status}`,
      });
      return { ok: false, reason: data.error || `HTTP ${res.status}` };
    }
    await setStatus({
      type: "ok",
      message: `Loja "${data.storeName || storeId}" atualizada`,
    });
    return { ok: true, storeName: data.storeName };
  } catch (err) {
    await setStatus({
      type: "error",
      message: `Erro de rede: ${err.message || err}`,
    });
    return { ok: false, reason: String(err) };
  }
}

function scheduleSync(trigger) {
  if (debounceHandle) clearTimeout(debounceHandle);
  debounceHandle = setTimeout(() => {
    debounceHandle = null;
    syncNow(trigger);
  }, DEBOUNCE_MS);
}

// --- Eventos ----------------------------------------------------------------

chrome.cookies.onChanged.addListener((info) => {
  if (info.cookie.domain.endsWith(APPBARBER_HOST) && info.cookie.name === COOKIE_NAME) {
    if (info.removed) return; // cookie deletado → ignora
    scheduleSync("cookieChange");
  }
});

// Mensagens vindas do popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "syncNow") {
    syncNow("manual").then(sendResponse);
    return true; // async
  }
  if (msg?.type === "readCookie") {
    readPhpSessionCookie().then((v) => sendResponse({ cookie: v }));
    return true;
  }
});

// Sanity check de hora em hora — se o cookie ainda estiver válido no browser,
// manda pro dashboard de novo (segura contra "cookie novo que a gente perdeu").
chrome.alarms.create("periodicSync", { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "periodicSync") syncNow("periodic");
});
