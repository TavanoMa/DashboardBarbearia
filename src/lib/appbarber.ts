import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type {
  AgendamentoRaw,
  AppBarberResponse,
  ComissaoDetalheRaw,
  ComissaoSinteticoRaw,
  FinanceiroGraficoMes,
} from "./types";

const BASE_URL = "https://sistema.appbarber.com.br";
const CONFIG_PATH = join(process.cwd(), ".appbarber.json");

function loadConfig(): { phpSessionId: string; appblzId: string } | null {
  if (process.env.APPBARBER_PHPSESSID) {
    return {
      phpSessionId: process.env.APPBARBER_PHPSESSID,
      appblzId: process.env.APPBARBER_APPBLZID || "",
    };
  }
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function getCookies(): string {
  const config = loadConfig();
  if (!config?.phpSessionId) return "";
  let cookie = `PHPSESSID=${config.phpSessionId}`;
  if (config.appblzId) cookie += `; APPBLZ_ID=${config.appblzId}`;
  return cookie;
}

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

async function postEndpoint(path: string, body: URLSearchParams): Promise<unknown> {
  const cookie = getCookies();
  if (!cookie) return null;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { ...defaultHeaders, cookie },
    body: body.toString(),
  });

  if (!res.ok) return null;
  return res.json();
}

async function getEndpoint(path: string): Promise<unknown> {
  const cookie = getCookies();
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
  }
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
    const data = await postEndpoint("/pages/relatorios/buscaAgendamentos.php", body) as AppBarberResponse | AgendamentoRaw[] | null;
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
  filtros?: { profissional?: string; servico?: string; pagamento?: string; categoria?: string }
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
    const data = await postEndpoint("/pages/relatorios/buscarelGerencialFinanceirov2.php", body) as FinanceiroRawResponse | null;
    if (!data) return [];
    if (Array.isArray(data.data)) return data.data;
    return [];
  } catch {
    return [];
  }
}

export async function buscarFinanceiroGrafico(
  dataIni: Date,
  dataFim: Date
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
    const raw = await postEndpoint("/pages/relatorios/buscaGraficoRelGerencialFinanceirov2.php", body) as { data: unknown[]; data2: unknown[] } | null;
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
  filtros?: { profissional?: string; servico?: string }
): Promise<ComissaoDetalheRaw[]> {
  const body = new URLSearchParams({
    dataIni: formatDate(dataIni),
    dataFim: formatDate(dataFim),
    profissional: filtros?.profissional || "",
    servico: filtros?.servico || "",
  });

  try {
    const data = await postEndpoint("/pages/relatorios/buscaComissoesProfissionaisv2.php", body) as ComissaoResponse | null;
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
  filtros?: { profissional?: string; servico?: string }
): Promise<ComissaoSinteticoRaw[]> {
  const body = new URLSearchParams({
    dataIni: formatDate(dataIni),
    dataFim: formatDate(dataFim),
    profissional: filtros?.profissional || "",
    servico: filtros?.servico || "",
  });

  try {
    const data = await postEndpoint("/pages/relatorios/buscaComissoesProfissionaisTotalSinteticov2.php", body) as ComissaoSinteticoResponse | null;
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
  tipo: number = 4
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
    const data = await postEndpoint("/pages/relatorios/buscaRelGerencialFluxoCaixa.php", body) as FinanceiroRawResponse | null;
    if (!data) return [];
    if (Array.isArray(data.data)) return data.data;
    return [];
  } catch {
    return [];
  }
}


// --- Resumo Dashboard ---

export async function buscarResumoDashboard(): Promise<Record<string, string>[]> {
  const body = new URLSearchParams({});

  try {
    const data = await postEndpoint("/pages/relatorios/buscaRelDashboard.php", body) as { data: Record<string, string>[] } | null;
    if (!data) return [];
    if (Array.isArray(data.data)) return data.data;
    return [];
  } catch {
    return [];
  }
}


// --- Estoque ---

export async function buscarProdutos(): Promise<Record<string, string>[]> {
  try {
    const data = await getEndpoint("/pages/cadastros/buscaProdutos.php") as AppBarberResponse | null;
    if (!data) return [];
    if (Array.isArray(data.data)) return data.data as unknown as Record<string, string>[];
    return [];
  } catch {
    return [];
  }
}

export function isSessionConfigured(): boolean {
  const config = loadConfig();
  return !!config?.phpSessionId;
}

function parseMoneyRaw(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace("R$", "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}
