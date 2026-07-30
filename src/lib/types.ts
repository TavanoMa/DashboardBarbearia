export interface AgendamentoRaw {
  DT_RowId: number;
  Servico: string;
  Cliente: string;
  CodCliente: string;
  Telefone: string;
  Profissional: string;
  DataIni: string;
  DataFim: string;
  Valor: string;
  FormaPgto: string;
  Pontos: string;
  Status: string;
  Obs: string;
  UsuNome: string;
  UsuData: string;
  btnInfo: string;
  Tipo: string;
  ComCodigo: string;
  ComCodigoExterno: string;
  CPF: string;
  Email: string;
  erro: string;
  resultado: string;
}

export interface Agendamento {
  id: number;
  servico: string;
  cliente: string;
  codCliente: string;
  telefone: string;
  profissional: string;
  dataIni: string;
  dataFim: string;
  hora: string;
  horaFim: string;
  valor: number;
  formaPgto: string;
  status: StatusAgendamento;
  obs: string;
  tipo: string;
  email: string;
}

export type StatusAgendamento =
  | "Realizado"
  | "Agendado"
  | "Cancelado"
  | "Ausente"
  | "Bloqueado"
  | "Desconhecido";

export interface MetricasDia {
  totalAgendamentos: number;
  realizados: number;
  agendados: number;
  cancelados: number;
  ausentes: number;
  bloqueados: number;
  faturamentoRealizado: number;
  faturamentoPrevisto: number;
  ticketMedio: number;
  clientesUnicos: number;
}

export interface AppBarberResponse {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: AgendamentoRaw[];
}

// --- Financial types ---

export interface FinanceiroResumo {
  totalBruto: number;
  totalLiquido: number;
  totalTaxas: number;
}

export interface FinanceiroBandeira {
  bandeira: string;
  totalBruto: number;
  totalLiquido: number;
  totalTaxas: number;
}

export interface FinanceiroTransacao {
  tipoPagamento: string;
  bandeira: string;
  dataMovimentacao: string;
  valorBruto: number;
  valorTaxa: number;
  valorLiquido: number;
  comCodigo: string;
}

export interface FinanceiroGraficoMes {
  mes: string;
  mesNum: number;
  anoNum: number;
  totalBruto: number;
  totalLiquido: number;
  totalProduto: number;
  totalServico: number;
  totalOutros: number;
}

// --- Commission types ---

export interface ComissaoDetalheRaw {
  DT_RowId: string;
  Profissional: string;
  Servico: string;
  DataAgendamento: string;
  Valor: string;
  ValorItem: string;
  Porcentagem: string;
  Cliente: string;
  Total: string;
  TotalServico: string;
  TotalProduto: string;
  TotalPacote: string;
  TotalGorjeta: string;
  TotalAuxiliar: string;
  TotalAssinatura: string;
  TotalBonificacao: string;
  TotalDesconto: string;
  Valorliq: string;
  ValorItemliq: string;
  TotalLiq: string;
  DataRecebimento: string;
  ComissaoLiq2: string;
  Taxa: string;
  Pagamento: string;
  DataFinalizacao: string;
  ComissaoPaga: string;
  Comanda: string;
  CPr_Codigo: string;
  CPr_Pago: string;
  CPr_Contabiliza: string;
}

export interface ComissaoDetalhe {
  profissional: string;
  servico: string;
  dataAgendamento: string;
  valor: number;
  valorItem: number;
  porcentagem: string;
  cliente: string;
  total: number;
  totalLiq: number;
  pagamento: string;
  comissaoPaga: string;
}

export interface ComissaoSinteticoRaw {
  cprcodigo: string;
  descricao: string;
  bruto: string;
  liquido: string;
  descontado: string;
  itens: string;
  origens: string;
  numeroItens: number;
}

export interface ComissaoSintetico {
  descricao: string;
  bruto: number;
  liquido: number;
  descontado: number;
  numeroItens: number;
}

export interface ComissaoProfissional {
  nome: string;
  totalBruto: number;
  totalLiquido: number;
  totalDesconto: number;
  atendimentos: number;
  servicos: number;
  produtos: number;
}

// --- Fluxo de Caixa (Comanda) types ---

export interface ComandaDetalhe {
  descricao: string;
  cliente: string;
  valorBruto: number;
  valorReal: number;
  dataCadastro: string;
  tipoPagamento: string;
  comCodigo: string;
  codExterno: string;
}

export interface FormaPagamentoResumo {
  tipoPagamento: string;
  totalBruto: number;
}
