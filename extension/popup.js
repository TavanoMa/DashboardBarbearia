// Popup — carrega config, lista lojas via /api/auth/status, salva e dispara sync.

const KEYS = ["dashboardUrl", "syncToken", "storeId", "autoSync", "lastStatus", "lastStatusAt"];
const DASHBOARD_URL_PADRAO = "https://dashboard-two-teal-35.vercel.app";

async function load() {
  const cfg = await chrome.storage.local.get(KEYS);
  // URL fica pré-preenchida (read-only no HTML). Se ainda não tiver nada salvo,
  // já grava a padrão pra o botão "Sincronizar" funcionar na primeira vez.
  const url = cfg.dashboardUrl || DASHBOARD_URL_PADRAO;
  document.getElementById("dashboardUrl").value = url;
  if (!cfg.dashboardUrl) {
    await chrome.storage.local.set({ dashboardUrl: url });
  }
  document.getElementById("syncToken").value = cfg.syncToken || "";
  document.getElementById("autoSync").checked = cfg.autoSync !== false;
  await popularLojas(url, cfg.storeId);
  renderStatus(cfg.lastStatus, cfg.lastStatusAt);
}

async function popularLojas(dashboardUrl, selectedId) {
  const sel = document.getElementById("storeId");
  sel.innerHTML = '<option value="">—</option>';
  if (!dashboardUrl) return;
  try {
    const res = await fetch(`${dashboardUrl.replace(/\/$/, "")}/api/auth/status`);
    const data = await res.json();
    const stores = Array.isArray(data.stores) ? data.stores : [];
    for (const s of stores) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || s.id;
      if (s.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    }
    if (!stores.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "(nenhuma loja encontrada)";
      sel.appendChild(opt);
    }
  } catch (err) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(erro ao listar lojas)";
    sel.appendChild(opt);
  }
}

async function save() {
  const dashboardUrl =
    document.getElementById("dashboardUrl").value.trim() || DASHBOARD_URL_PADRAO;
  const syncToken = document.getElementById("syncToken").value.trim();
  const storeId = document.getElementById("storeId").value;
  const autoSync = document.getElementById("autoSync").checked;
  await chrome.storage.local.set({ dashboardUrl, syncToken, storeId, autoSync });
  await popularLojas(dashboardUrl, storeId);
  flash("Configurações salvas.");
}

function flash(msg) {
  renderStatus({ type: "ok", message: msg }, new Date().toISOString());
}

function renderStatus(status, when) {
  const el = document.getElementById("status");
  const dot = document.getElementById("dot");
  const msg = document.getElementById("msg");
  const whenEl = document.getElementById("when");
  el.className = "status";
  dot.className = "dot";
  if (status) {
    el.classList.add(status.type);
    dot.classList.add(status.type);
    msg.textContent = status.message || "";
    whenEl.textContent = when ? `Última atualização: ${new Date(when).toLocaleString()}` : "";
  } else {
    msg.textContent = "Sem status ainda. Clique em Sincronizar.";
    whenEl.textContent = "";
  }
}

document.getElementById("btnSave").addEventListener("click", save);
document.getElementById("btnSync").addEventListener("click", async () => {
  // garante que a config atual está salva antes do sync manual
  await save();
  const res = await chrome.runtime.sendMessage({ type: "syncNow" });
  if (res?.ok) {
    renderStatus({ type: "ok", message: `Loja "${res.storeName}" atualizada.` }, new Date().toISOString());
  } else {
    renderStatus({ type: "error", message: res?.reason || "Falhou" }, new Date().toISOString());
  }
});

// Re-renderiza quando o storage mudar (ex.: background atualizou o status)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.lastStatus || changes.lastStatusAt) {
    chrome.storage.local.get(["lastStatus", "lastStatusAt"]).then((c) => {
      renderStatus(c.lastStatus, c.lastStatusAt);
    });
  }
});

load();
