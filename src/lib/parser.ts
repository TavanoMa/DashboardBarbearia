import type {
  AgendamentoRaw,
  Agendamento,
  StatusAgendamento,
  MetricasDia,
  ComissaoDetalheRaw,
  ComissaoDetalhe,
  ComissaoSinteticoRaw,
  ComissaoSintetico,
  ComissaoProfissional,
  FinanceiroResumo,
  FinanceiroTransacao,
  ComandaDetalhe,
  FormaPagamentoResumo,
} from "./types";

export function parseStatus(statusHtml: string): StatusAgendamento {
  const titleMatch = statusHtml.match(/title='([^']+)'/);
  if (!titleMatch) return "Desconhecido";
  const title = titleMatch[1];
  switch (title) {
    case "Realizado":
      return "Realizado";
    case "Agendado":
      return "Agendado";
    case "Cancelado":
      return "Cancelado";
    case "Ausente":
      return "Ausente";
    case "Bloqueado":
      return "Bloqueado";
    default:
      return "Desconhecido";
  }
}

export function parseValor(valor: string): number {
  if (!valor || valor.trim() === "") return 0;
  return parseFloat(valor.replace(/\./g, "").replace(",", ".")) || 0;
}

export function parseMoneyBR(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace("R$", "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function extrairHora(dataStr: string): string {
  const parts = dataStr.split(" ");
  return parts[1] || "";
}

export function parseAgendamento(raw: AgendamentoRaw): Agendamento {
  return {
    id: raw.DT_RowId,
    servico: raw.Servico,
    cliente: raw.Cliente,
    codCliente: raw.CodCliente,
    telefone: raw.Telefone,
    profissional: raw.Profissional,
    dataIni: raw.DataIni,
    dataFim: raw.DataFim,
    hora: extrairHora(raw.DataIni),
    horaFim: extrairHora(raw.DataFim),
    valor: parseValor(raw.Valor),
    formaPgto: raw.FormaPgto,
    status: parseStatus(raw.Status),
    obs: raw.Obs.trim(),
    tipo: raw.Tipo,
    email: raw.Email,
  };
}

export function parseAgendamentos(rawList: AgendamentoRaw[]): Agendamento[] {
  return rawList.map(parseAgendamento);
}

export function calcularMetricas(agendamentos: Agendamento[]): MetricasDia {
  const realizados = agendamentos.filter((a) => a.status === "Realizado");
  const agendados = agendamentos.filter((a) => a.status === "Agendado");
  const cancelados = agendamentos.filter((a) => a.status === "Cancelado");
  const ausentes = agendamentos.filter((a) => a.status === "Ausente");

  const faturamentoRealizado = realizados.reduce((s, a) => s + a.valor, 0);
  const faturamentoPrevisto = agendados.reduce((s, a) => s + a.valor, 0);

  const clientesUnicos = new Set(
    agendamentos
      .filter((a) => a.cliente !== "Sem Cadastro" && a.codCliente)
      .map((a) => a.codCliente)
  ).size;

  return {
    totalAgendamentos: agendamentos.length,
    realizados: realizados.length,
    agendados: agendados.length,
    cancelados: cancelados.length,
    ausentes: ausentes.length,
    bloqueados: 0,
    faturamentoRealizado,
    faturamentoPrevisto,
    ticketMedio:
      realizados.length > 0 ? faturamentoRealizado / realizados.length : 0,
    clientesUnicos,
  };
}

export function agruparPorProfissional(agendamentos: Agendamento[]) {
  const map = new Map<
    string,
    { atendimentos: number; faturamento: number; agendados: number }
  >();

  for (const a of agendamentos) {
    const prof = a.profissional;
    const entry = map.get(prof) || { atendimentos: 0, faturamento: 0, agendados: 0 };
    if (a.status === "Realizado") {
      entry.atendimentos++;
      entry.faturamento += a.valor;
    } else if (a.status === "Agendado") {
      entry.agendados++;
    }
    map.set(prof, entry);
  }

  return Array.from(map.entries())
    .map(([nome, data]) => ({ nome, ...data }))
    .sort((a, b) => b.faturamento - a.faturamento);
}

export function agruparPorServico(agendamentos: Agendamento[]) {
  const map = new Map<string, { qty: number; total: number }>();

  for (const a of agendamentos.filter((a) => a.status === "Realizado")) {
    const entry = map.get(a.servico) || { qty: 0, total: 0 };
    entry.qty++;
    entry.total += a.valor;
    map.set(a.servico, entry);
  }

  return Array.from(map.entries())
    .map(([servico, data]) => ({ servico, ...data }))
    .sort((a, b) => b.total - a.total);
}

export function agruparPorFormaPgto(agendamentos: Agendamento[]) {
  const map = new Map<string, { qty: number; total: number }>();

  for (const a of agendamentos.filter(
    (a) => a.status === "Realizado" && a.formaPgto
  )) {
    const entry = map.get(a.formaPgto) || { qty: 0, total: 0 };
    entry.qty++;
    entry.total += a.valor;
    map.set(a.formaPgto, entry);
  }

  return Array.from(map.entries())
    .map(([forma, data]) => ({ forma, ...data }))
    .sort((a, b) => b.total - a.total);
}

// --- Financial parsers ---

export function parseFinanceiroResumo(raw: Record<string, string>[]): FinanceiroResumo {
  if (!raw || raw.length === 0) return { totalBruto: 0, totalLiquido: 0, totalTaxas: 0 };
  const r = raw[0];
  return {
    totalBruto: parseMoneyBR(r.TotalBruto),
    totalLiquido: parseMoneyBR(r.TotalLiquido),
    totalTaxas: parseMoneyBR(r.TotalTaxas),
  };
}

export function parseFinanceiroTransacoes(raw: Record<string, string>[]): FinanceiroTransacao[] {
  return (raw || []).map((r) => ({
    tipoPagamento: r.TipoPagamento || "",
    bandeira: r.Bandeira || "",
    dataMovimentacao: r.DataMovimentacao || "",
    valorBruto: parseMoneyBR(r.ValorBruto),
    valorTaxa: parseMoneyBR(r.ValorDaTaxa),
    valorLiquido: parseMoneyBR(r.ValorLiquido),
    comCodigo: r.Com_Codigo || "",
  }));
}

export function agruparTransacoesPorFormaPgto(transacoes: FinanceiroTransacao[]) {
  const map = new Map<string, { qty: number; total: number }>();
  for (const t of transacoes) {
    const key = t.tipoPagamento || "Outros";
    const entry = map.get(key) || { qty: 0, total: 0 };
    entry.qty++;
    entry.total += t.valorBruto;
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .map(([forma, data]) => ({ forma, ...data }))
    .sort((a, b) => b.total - a.total);
}

export function agruparTransacoesPorDia(transacoes: FinanceiroTransacao[]) {
  const map = new Map<string, number>();
  for (const t of transacoes) {
    const dia = t.dataMovimentacao.split(" ")[0] || "";
    if (!dia) continue;
    map.set(dia, (map.get(dia) || 0) + t.valorBruto);
  }
  return Array.from(map.entries())
    .map(([dia, valor]) => ({ dia, valor }))
    .sort((a, b) => {
      const [da, ma, ya] = a.dia.split("/").map(Number);
      const [db, mb, yb] = b.dia.split("/").map(Number);
      return (ya * 10000 + ma * 100 + da) - (yb * 10000 + mb * 100 + db);
    });
}

// --- Commission parsers ---

export function parseComissaoDetalhe(raw: ComissaoDetalheRaw): ComissaoDetalhe {
  return {
    profissional: raw.Profissional,
    servico: raw.Servico,
    dataAgendamento: raw.DataAgendamento,
    valor: parseMoneyBR(raw.Valor),
    valorItem: parseMoneyBR(raw.ValorItem),
    porcentagem: raw.Porcentagem,
    cliente: raw.Cliente,
    total: parseMoneyBR(raw.Total),
    totalLiq: parseMoneyBR(raw.TotalLiq),
    pagamento: raw.Pagamento,
    comissaoPaga: raw.ComissaoPaga,
  };
}

export function parseComissoes(rawList: ComissaoDetalheRaw[]): ComissaoDetalhe[] {
  return (rawList || []).map(parseComissaoDetalhe);
}

export function parseComissaoSintetico(raw: ComissaoSinteticoRaw): ComissaoSintetico {
  const descClean = raw.descricao.replace(/<[^>]+>/g, "").trim();
  return {
    descricao: descClean,
    bruto: parseMoneyBR(raw.bruto),
    liquido: parseMoneyBR(raw.liquido),
    descontado: parseMoneyBR(raw.descontado),
    numeroItens: raw.numeroItens || 0,
  };
}

export function parseComissoesSintetico(rawList: ComissaoSinteticoRaw[]): ComissaoSintetico[] {
  return (rawList || []).map(parseComissaoSintetico).filter((c) => c.descricao);
}

// --- Fluxo de Caixa / Comanda parsers ---

export function parseComandas(raw: Record<string, string>[]): ComandaDetalhe[] {
  return (raw || []).map((r) => ({
    descricao: (r.descricao || "").replace(/<[^>]+>/g, "").trim(),
    cliente: r.Pes_Nome || "",
    valorBruto: parseMoneyBR(r.TotalBruto),
    valorReal: parseMoneyBR(r.TotalBrutoReal),
    dataCadastro: r.DataCadastro || "",
    tipoPagamento: r.TPa_Descricao || "",
    comCodigo: r.Com_Codigo || "",
    codExterno: r.CCE_Cod_Externo || "",
  }));
}

export function parseFormasPagamentoResumo(raw: Record<string, string>[]): FormaPagamentoResumo[] {
  return (raw || []).map((r) => ({
    tipoPagamento: r.TPa_Descricao || "",
    totalBruto: parseMoneyBR(r.TotalBruto),
  })).filter((f) => f.tipoPagamento && f.totalBruto > 0);
}

export function agruparComissoesPorProfissional(comissoes: ComissaoDetalhe[]): ComissaoProfissional[] {
  const map = new Map<string, ComissaoProfissional>();

  for (const c of comissoes) {
    const prof = c.profissional;
    if (!prof) continue;
    const entry = map.get(prof) || {
      nome: prof,
      totalBruto: 0,
      totalLiquido: 0,
      totalDesconto: 0,
      atendimentos: 0,
      servicos: 0,
      produtos: 0,
    };
    entry.atendimentos++;
    entry.totalBruto += c.valor;
    entry.totalLiquido += c.valorItem;
    map.set(prof, entry);
  }

  return Array.from(map.values()).sort((a, b) => b.totalBruto - a.totalBruto);
}
