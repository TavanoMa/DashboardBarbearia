import type {
  AgendamentoRaw,
  AppBarberResponse,
  ComissaoDetalheRaw,
  ComissaoSinteticoRaw,
  FinanceiroGraficoMes,
} from "./types";
import { getActiveSessions, getActiveSessionsSync, type StoreSessions } from "./appbarber-auth";

const BASE_URL = "https://sistema.appbarber.com.br";

// ---------------------------------------------------------------------------
// Multi-store config — now powered by appbarber-auth session manager
// ---------------------------------------------------------------------------

export interface StoreConfig {
  id: string;
  name: string;
  phpSessionId: string;
  appblzId: string;
}

function toStoreConfigs(sessions: StoreSessions[]): StoreConfig[] {
  return sessions.map((s) => ({
    id: s.id,
    name: s.name,
    phpSessionId: s.phpSessionId,
    appblzId: s.appblzId,
  }));
}

/**
 * Load all stores — async version that reads KV (Vercel production).
 * Always prefer this in async contexts (API routes).
 */
async function loadAllStoresAsync(): Promise<StoreConfig[]> {
  const sessions = await getActiveSessions();
  return toStoreConfigs(sessions);
}

/**
 * Sync fallback — only uses memory cache + local file.
 * Use only where async is impossible.
 */
function loadAllStoresSync(): StoreConfig[] {
  const sessions = getActiveSessionsSync();
  return toStoreConfigs(sessions);
}

async function getStoreConfigAsync(storeId?: string): Promise<StoreConfig | null> {
  const stores = await loadAllStoresAsync();
  if (stores.length === 0) return null;
  if (!storeId) return stores[0];
  return stores.find((s) => s.id === storeId) || stores[0];
}

export function getStores(): StoreConfig[] {
  return loadAllStoresSync();
}

export async function getStoresAsync(): Promise<StoreConfig[]> {
  return loadAllStoresAsync();
}

async function getCookies(storeId?: string): Promise<string> {
  const config = await getStoreConfigAsync(storeId);
  if (!config?.phpSessionId) return "";
  let cookie = `PHPSESSID=${config.phpSessionId}`;
  if (config.appblzId) cookie += `; APPBLZ_ID=${config.appblzId}`;
  return cookie;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const defaultHeaders: Record<string, string> = {
  accept: "application/json, text/javascript, */*; q=0.01",
  "accept-language": "pt-BR,pt;q=0.9",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  origin: BASE_URL,
  referer: `${BASE_URL}/index.php`,
  "x-requested-with": "XMLHttpRequest",
};

function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

async function postEndpoint(path: string, body: URLSearchParams, storeId?: string): Promise<unknown> {
  const cookie = await getCookies(storeId);
  if (!cookie) return null;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { ...defaultHeaders, cookie },
    body: body.toString(),
  });

  if (!res.ok) return null;
  return res.json();
}

async function getEndpoint(path: string, storeId?: string): Promise<unknown> {
  const cookie = await getCookies(storeId);
  if (!cookie) return null;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { ...defaultHeaders, cookie },
  });

  if (!res.ok) return null;
  return res.json();
}

// --- Agendamentos ---

export async function buscarAgendamentosRaw(
  dataIni: Date,
  dataFim: Date,
  filtros?: {
    tipoStatus?: string;
    cliente?: string;
    profissional?: string;
    servico?: string;
  },
  storeId?: string
): Promise<AgendamentoRaw[]> {
  const body = new URLSearchParams({
    edtDataIni: formatDate(dataIni),
    edtDataFim: formatDate(dataFim),
    tipoStatus: filtros?.tipoStatus || "",
    AgeCliente: filtros?.cliente || "",
    AgeProfissional: filtros?.profissional || "",
    AgeServico: filtros?.servico || "",
  });

  try {
    const data = await postEndpoint("/pages/relatorios/buscaAgendamentos.php", body, storeId) as AppBarberResponse | AgendamentoRaw[] | null;
    if (!data) return [];
    if ("data" in data && Array.isArray(data.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
}

// --- Financeiro ---

interface FinanceiroRawResponse {
  data: Array<Record<string, string>> | { erro: string; resultado: string };
}

export async function buscarFinanceiroResumo(
  dataIni: Date,
  dataFim: Date,
  tipo: number = 1,
  filtros?: { profissional?: string; servico?: string; pagamento?: string; categoria?: string },
  storeId?: string
): Promise<Record<string, string>[]> {
  const body = new URLSearchParams({
    dataIni: formatDate(dataIni),
    dataFim: formatDate(dataFim),
    tipoBusca: "1",
    tipo: tipo.toString(),
    profissional: filtros?.profissional || "",
    servico: filtros?.servico || "",
    pagamento: filtros?.pagamento || "",
    categoria: filtros?.categoria || "",
  });

  try {
    const data = await postEndpoint("/pages/relatorios/buscarelGerencialFinanceirov2.php", body, storeId) as FinanceiroRawResponse | null;
    if (!data) return [];
    if (Array.isArray(data.data)) return data.data;
    return [];
  } catch {
    return [];
  }
}

export async function buscarFinanceiroGrafico(
  dataIni: Date,
  dataFim: Date,
  storeId?: string
): Promise<{ data: FinanceiroGraficoMes[]; data2: FinanceiroGraficoMes[] }> {
  const body = new URLSearchParams({
    dataIni: formatDate(dataIni),
    dataFim: formatDate(dataFim),
    tipoBusca: "1",
    profissional: "",
    servico: "",
    pagamento: "",
    categoria: "",
  });

  try {
    const raw = await postEndpoint("/pages/relatorios/buscaGraficoRelGerencialFinanceirov2.php", body, storeId) as { data: unknown[]; data2: unknown[] } | null;
    if (!raw) return { data: [], data2: [] };

    const parse = (items: unknown[]): FinanceiroGraficoMes[] =>
      (items || []).map((item: unknown) => {
        const r = item as Record<string, string>;
        return {
          mes: r.Mes || "",
          mesNum: parseInt(r.MesNum) || 0,
          anoNum: parseInt(r.AnoNum) || 0,
          totalBruto: parseMoneyRaw(r.TotalBruto),
          totalLiquido: parseMoneyRaw(r.TotalLiquido),
          totalProduto: parseMoneyRaw(r.TotalProduto),
          totalServico: parseMoneyRaw(r.TotalServico),
          totalOutros: parseMoneyRaw(r.TotalOutros),
        };
      });

    return { data: parse(raw.data), data2: parse(raw.data2) };
  } catch {
    return { data: [], data2: [] };
  }
}

// --- Comissões ---

interface ComissaoResponse {
  data: ComissaoDetalheRaw[] | { erro: string };
}

export async function buscarComissoes(
  dataIni: Date,
  dataFim: Date,
  filtros?: { profissional?: string; servico?: string },
  storeId?: string
): Promise<ComissaoDetalheRaw[]> {
  const body = new URLSearchParams({
    dataIni: formatDate(dataIni),
    dataFim: formatDate(dataFim),
    profissional: filtros?.profissional || "",
    servico: filtros?.servico || "",
  });

  try {
    const data = await postEndpoint("/pages/relatorios/buscaComissoesProfissionaisv2.php", body, storeId) as ComissaoResponse | null;
    if (!data) return [];
    if (Array.isArray(data.data)) return data.data;
    return [];
  } catch {
    return [];
  }
}

interface ComissaoSinteticoResponse {
  data: ComissaoSinteticoRaw[] | { erro: string };
}

export async function buscarComissoesSintetico(
  dataIni: Date,
  dataFim: Date,
  filtros?: { profissional?: string; servico?: string },
  storeId?: string
): Promise<ComissaoSinteticoRaw[]> {
  const body = new URLSearchParams({
    dataIni: formatDate(dataIni),
    dataFim: formatDate(dataFim),
    profissional: filtros?.profissional || "",
    servico: filtros?.servico || "",
  });

  try {
    const data = await postEndpoint("/pages/relatorios/buscaComissoesProfissionaisTotalSinteticov2.php", body, storeId) as ComissaoSinteticoResponse | null;
    if (!data) return [];
    if (Array.isArray(data.data)) return data.data;
    return [];
  } catch {
    return [];
  }
}

// --- Fluxo de Caixa ---

export async function buscarFluxoCaixa(
  dataIni: Date,
  dataFim: Date,
  tipo: number = 4,
  storeId?: string
): Promise<Record<string, string>[]> {
  const body = new URLSearchParams({
    dataIni: formatDate(dataIni),
    dataFim: formatDate(dataFim),
    tipoBusca: "1",
    tipo: tipo.toString(),
    profissional: "",
    servico: "",
    pagamento: "",
    categoria: "",
  });

  try {
    const data = await postEndpoint("/pages/relatorios/buscaRelGerencialFluxoCaixa.php", body, storeId) as FinanceiroRawResponse | null;
    if (!data) return [];
    if (Array.isArray(data.data)) return data.data;
    return [];
  } catch {
    return [];
  }
}


// --- Resumo Dashboard ---

export async function buscarResumoDashboard(storeId?: string): Promise<Record<string, string>[]> {
  const body = new URLSearchParams({});

  try {
    const data = await postEndpoint("/pages/relatorios/buscaRelDashboard.php", body, storeId) as { data: Record<string, string>[] } | null;
    if (!data) return [];
    if (Array.isArray(data.data)) return data.data;
    return [];
  } catch {
    return [];
  }
}


// --- Estoque ---

export async function buscarProdutos(storeId?: string): Promise<Record<string, string>[]> {
  try {
    const data = await getEndpoint("/pages/cadastros/buscaProdutos.php", storeId) as AppBarberResponse | null;
    if (!data) return [];
    if (Array.isArray(data.data)) return data.data as unknown as Record<string, string>[];
    return [];
  } catch {
    return [];
  }
}

export async function isSessionConfigured(storeId?: string): Promise<boolean> {
  const config = await getStoreConfigAsync(storeId);
  return !!config?.phpSessionId;
}

function parseMoneyRaw(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace("R$", "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}
