// Lógica do módulo financeiro, espelhando as fórmulas da planilha do cliente
// (abas ENTRADAS, SAÍDAS, CONTAS A RECEBER/PAGAR, Fluxo de Caixa e ESTRUTURA).

export const CAIXA_MINIMO = 10000;
export const MARGEM_SEGURANCA = 0.2;
export const CAIXA_SEGURO = CAIXA_MINIMO * (1 + MARGEM_SEGURANCA);
export const META_MENSAL = 60000;

export const CATEGORIAS_ENTRADA = ["Serviço", "Produtos", "Outros"] as const;
export const FORMAS_PAGAMENTO = ["Dinheiro", "Pix", "Cartões", "Boleto", "Outros"] as const;
export const CANAIS = [
  "Recorrência",
  "Indicação",
  "Balcão",
  "Redes Sociais",
  "Tráfego Pago",
  "Comunicação Direta",
  "Plataformas",
  "Busca",
  "Parcerias",
] as const;
export const RESPONSAVEIS = ["Empresa", "Pessoal", "Híbrido"] as const;
export const IMPACTOS = ["Essencial", "Importante", "Supérfluo"] as const;

// Categoria (departamento) → tipos de saída, como na TABELA AUXILIAR que alimenta o DRE.
export const CATEGORIAS_SAIDA: { nome: string; tipos: string[] }[] = [
  { nome: "Custo Operacional", tipos: ["Matéria-prima", "Insumos diretos", "Peças / mercadorias", "Encargos operacionais", "Terceirização operacional", "Logística operacional", "Produção", "Manutenção de equipamentos", "Ferramentas operacionais"] },
  { nome: "Despesa Fixa", tipos: ["Aluguel", "Salários operacionais", "Energia elétrica (mínimo fixo)", "Água", "Internet", "Telefonia", "Sistemas / softwares (ERP, CRM, etc.)", "Contabilidade", "Segurança / monitoramento", "Limpeza", "Pró-labore (Dono)"] },
  { nome: "Despesa Variável", tipos: ["Bonificações / premiações", "Fretes sobre vendas", "Embalagens", "Insumos indiretos", "Custos com plataformas (marketplace, apps)"] },
  { nome: "Despesa Administrativa", tipos: ["Salários administrativos", "Encargos trabalhistas (adm)", "RH / recrutamento", "Treinamentos", "Materiais de escritório", "Consultorias (jurídica, contábil, etc.)", "Softwares administrativos", "Despesas com diretoria"] },
  { nome: "Despesa Comercial", tipos: ["Agência de marketing", "Tráfego pago", "Comissões de vendedores", "Salários equipe comercial", "CRM de vendas", "Materiais promocionais", "Eventos / feiras", "Prospecção (ligações, ferramentas)"] },
  { nome: "Despesa Financeira", tipos: ["Juros de empréstimos", "Juros de financiamentos", "Multas e encargos", "Tarifas bancárias", "Taxas de antecipação de recebíveis", "Descontos concedidos (financeiros)"] },
  { nome: "Despesa Tributária", tipos: ["Simples Nacional / DAS", "ISS", "Outros impostos"] },
  { nome: "Investimento (CAPEX)", tipos: ["Compra de máquinas/equipamentos", "Reforma / estrutura", "Móveis e utensílios", "Veículos", "Tecnologia (hardware)", "Expansão de unidade"] },
  { nome: "Depreciação", tipos: ["Depreciação de máquinas", "Depreciação de equipamentos", "Depreciação de veículos", "Depreciação de móveis", "Depreciação de instalações"] },
  { nome: "Provisões", tipos: ["Provisão de 13º salário", "Provisão de férias", "Provisão de encargos trabalhistas", "Provisão de impostos", "Provisão para inadimplência", "Provisão para contingências (processos, etc.)"] },
  { nome: "Retirada", tipos: ["Uso pessoal (Dono)"] },
];

export interface ContaBancaria {
  nome: string;
  tipo: string;
  saldoInicial: number;
}

export interface Entrada {
  id: string;
  tipo: "entrada";
  data: string; // yyyy-mm-dd
  categoria: string;
  item: string;
  cliente: string;
  descricao: string;
  valorCobranca: number;
  taxa: number;
  forma: string;
  canal: string;
  conta: string;
  exemplo?: boolean;
}

export interface Saida {
  id: string;
  tipo: "saida";
  dataVencimento: string;
  dataPagamento: string;
  descricao: string;
  categoria: string;
  tipoSaida: string;
  valorConta: number;
  juros: number;
  forma: string;
  conta: string;
  responsavel: string;
  impacto: string;
  geraReceita: boolean;
  parcela: string;
  exemplo?: boolean;
}

export type Lancamento = Entrada | Saida;

export interface ContaPrevista {
  id: string;
  tipo: "receber" | "pagar";
  vencimento: string;
  descricao: string;
  valor: number;
  pago: boolean;
}

export const valorLiquido = (e: Entrada) => e.valorCobranca - e.taxa;
export const valorPago = (s: Saida) => s.valorConta + s.juros;

export function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const diaSemana = (iso: string) => SEMANA[new Date(iso + "T12:00:00").getDay()];
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export type StatusCaixa = "Positivo" | "Negativo" | "Neutro";
const statusDe = (saldo: number): StatusCaixa =>
  saldo > 0 ? "Positivo" : saldo < 0 ? "Negativo" : "Neutro";

export interface LinhaRealizado {
  data: string;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  movimento: number;
  saldoFinal: number;
  status: StatusCaixa;
}

// Fluxo de Caixa › Realizado. Diferença proposital da planilha: entradas usam o valor
// líquido (a planilha soma o valor cobrado e ignora a taxa da maquininha).
export function calcRealizado(
  lancamentos: Lancamento[],
  saldoInicialMes: number,
  ano: number,
  mes: number,
  ateDia: number
): LinhaRealizado[] {
  const linhas: LinhaRealizado[] = [];
  let saldo = saldoInicialMes;
  for (let d = 1; d <= ateDia; d++) {
    const data = isoDate(new Date(ano, mes, d));
    let entradas = 0;
    let saidas = 0;
    for (const l of lancamentos) {
      if (l.tipo === "entrada" && l.data === data) entradas += valorLiquido(l);
      if (l.tipo === "saida" && l.dataPagamento === data) saidas += valorPago(l);
    }
    const movimento = entradas - saidas;
    const saldoFinal = saldo + movimento;
    linhas.push({ data, saldoInicial: saldo, entradas, saidas, movimento, saldoFinal, status: statusDe(saldoFinal) });
    saldo = saldoFinal;
  }
  return linhas;
}

export interface LinhaProjecao {
  data: string;
  entradasPrevistas: number;
  saidasPrevistas: number;
  resultado: number;
  saldoProjetado: number;
  status: StatusCaixa;
}

// Fluxo de Caixa › Projeção. Só contas ainda não pagas (SUMIFS "<>PAGO").
// Começa hoje (contas que vencem hoje e ainda não foram pagas), sobre o saldo final de hoje.
export function calcProjecao(
  contas: ContaPrevista[],
  saldoHoje: number,
  hoje: string,
  ano: number,
  mes: number
): LinhaProjecao[] {
  const linhas: LinhaProjecao[] = [];
  let saldo = saldoHoje;
  const ultimo = diasNoMes(ano, mes);
  const diaHoje = Number(hoje.slice(8, 10));
  for (let d = diaHoje; d <= ultimo; d++) {
    const data = isoDate(new Date(ano, mes, d));
    let entradasPrevistas = 0;
    let saidasPrevistas = 0;
    for (const c of contas) {
      if (c.pago || c.vencimento !== data) continue;
      if (c.tipo === "receber") entradasPrevistas += c.valor;
      else saidasPrevistas += c.valor;
    }
    const resultado = entradasPrevistas - saidasPrevistas;
    saldo += resultado;
    linhas.push({ data, entradasPrevistas, saidasPrevistas, resultado, saldoProjetado: saldo, status: statusDe(saldo) });
  }
  return linhas;
}

export type StatusNecessidade = "Ideal" | "Saudável" | "Abaixo";

export interface LinhaControle {
  data: string;
  saldoProjetado: number;
  deficit: number;
  emDeficit: boolean;
  necessidade: number;
  status: StatusNecessidade;
}

// Controle da Projeção: Déficit = MIN(0, saldo); Necessidade = MAX(0, caixa seguro − saldo);
// Status = IDEAL (≥ seguro), SAUDÁVEL (≥ mínimo), ABAIXO.
export function calcControle(projecao: LinhaProjecao[]): LinhaControle[] {
  return projecao.map((p) => {
    const deficit = Math.min(0, p.saldoProjetado);
    return {
      data: p.data,
      saldoProjetado: p.saldoProjetado,
      deficit,
      emDeficit: deficit < 0,
      necessidade: Math.max(0, CAIXA_SEGURO - p.saldoProjetado),
      status:
        p.saldoProjetado >= CAIXA_SEGURO ? "Ideal" : p.saldoProjetado >= CAIXA_MINIMO ? "Saudável" : "Abaixo",
    };
  });
}

export function atrasados(contas: ContaPrevista[], hoje: string) {
  let receber = 0;
  let pagar = 0;
  for (const c of contas) {
    if (c.pago || c.vencimento >= hoje) continue;
    if (c.tipo === "receber") receber += c.valor;
    else pagar += c.valor;
  }
  return { receber, pagar };
}

// ESTRUTURA › Passo 2: saldo atual = saldo inicial + entradas líquidas − saídas pagas, por conta.
export function saldoPorConta(contas: ContaBancaria[], lancamentos: Lancamento[], ate: string) {
  return contas.map((c) => {
    let saldo = c.saldoInicial;
    for (const l of lancamentos) {
      if (l.conta !== c.nome) continue;
      if (l.tipo === "entrada" && l.data <= ate) saldo += valorLiquido(l);
      if (l.tipo === "saida" && l.dataPagamento <= ate) saldo -= valorPago(l);
    }
    return { ...c, saldo };
  });
}

// Saldo inicial de um mês = saldo final do mês anterior (a planilha pede para digitar à mão).
export function saldoAntesDe(contas: ContaBancaria[], lancamentos: Lancamento[], data: string): number {
  let saldo = contas.reduce((s, c) => s + c.saldoInicial, 0);
  for (const l of lancamentos) {
    if (l.tipo === "entrada" && l.data < data) saldo += valorLiquido(l);
    if (l.tipo === "saida" && l.dataPagamento < data) saldo -= valorPago(l);
  }
  return saldo;
}

export const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function mesRelativo(hoje: Date, offset: number) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1);
  const ano = d.getFullYear();
  const mes = d.getMonth();
  const fechado = offset < 0;
  const ultimo = diasNoMes(ano, mes);
  return {
    ano,
    mes,
    fechado,
    inicio: isoDate(d),
    fim: fechado ? isoDate(new Date(ano, mes, ultimo)) : isoDate(hoje),
    ateDia: fechado ? ultimo : hoje.getDate(),
    nome: `${NOMES_MES[mes]} ${ano}`,
  };
}

export function somarPor<T>(itens: T[], chave: (i: T) => string, valor: (i: T) => number) {
  const mapa = new Map<string, number>();
  for (const i of itens) mapa.set(chave(i), (mapa.get(chave(i)) || 0) + valor(i));
  return [...mapa.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
}
