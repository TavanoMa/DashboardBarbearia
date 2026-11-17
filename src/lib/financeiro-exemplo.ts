// Dados de exemplo para demonstração do módulo financeiro (não são dados reais do cliente).
// Gera o mês anterior completo e o mês atual até hoje, mais as contas que ainda vão vencer.
import {
  calcProjecao,
  calcRealizado,
  diasNoMes,
  isoDate,
  saldoAntesDe,
  taxaCartao,
  type ContaBancaria,
  type ContaPrevista,
  type Lancamento,
} from "./financeiro";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, pesos: [T, number][]): T {
  const total = pesos.reduce((s, [, p]) => s + p, 0);
  let x = r() * total;
  for (const [v, p] of pesos) {
    x -= p;
    if (x <= 0) return v;
  }
  return pesos[pesos.length - 1][0];
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const SERVICOS: [string, string, number][] = [
  ["Serviço", "Corte", 45],
  ["Serviço", "Corte + barba", 70],
  ["Serviço", "Barba", 35],
  ["Serviço", "Corte degradê", 50],
  ["Serviço", "Sobrancelha", 15],
  ["Produtos", "Pomada modeladora", 45],
  ["Produtos", "Óleo para barba", 39],
];
const CLIENTES = ["Pedro", "Lucas", "Rafael", "Diego", "Mateus", "Gabriel", "Bruno", "Felipe", "Thiago", "André", "Vinícius", "Caio", "Gustavo", "Leonardo", "Murilo"];

const PAGAMENTOS_FIXOS: { dia: number; descricao: string; categoria: string; tipoSaida: string; valor: number; forma: string; impacto: string; geraReceita: boolean; responsavel?: string }[] = [
  { dia: 5, descricao: "Conta de luz", categoria: "Despesa Fixa", tipoSaida: "Energia elétrica (mínimo fixo)", valor: 420, forma: "Boleto", impacto: "Essencial", geraReceita: false },
  { dia: 5, descricao: "Internet", categoria: "Despesa Fixa", tipoSaida: "Internet", valor: 130, forma: "Boleto", impacto: "Essencial", geraReceita: false },
  { dia: 8, descricao: "Anúncios no Instagram", categoria: "Despesa Comercial", tipoSaida: "Tráfego pago", valor: 600, forma: "Cartão Crédito", impacto: "Importante", geraReceita: true },
  { dia: 10, descricao: "Aluguel do salão", categoria: "Despesa Fixa", tipoSaida: "Aluguel", valor: 4500, forma: "Pix", impacto: "Essencial", geraReceita: false },
  { dia: 15, descricao: "Comissão dos barbeiros (1ª quinzena)", categoria: "Custo Operacional", tipoSaida: "Terceirização operacional", valor: 7000, forma: "Pix", impacto: "Essencial", geraReceita: true },
  { dia: 18, descricao: "Contabilidade", categoria: "Despesa Fixa", tipoSaida: "Contabilidade", valor: 450, forma: "Pix", impacto: "Essencial", geraReceita: false },
  { dia: 20, descricao: "Simples Nacional (DAS)", categoria: "Despesa Tributária", tipoSaida: "Simples Nacional / DAS", valor: 1800, forma: "Boleto", impacto: "Essencial", geraReceita: false },
  { dia: 22, descricao: "Café e lanches para clientes", categoria: "Despesa Variável", tipoSaida: "Insumos indiretos", valor: 280, forma: "Pix", impacto: "Supérfluo", geraReceita: false },
  { dia: 25, descricao: "Sistema de agendamento", categoria: "Despesa Fixa", tipoSaida: "Sistemas / softwares (ERP, CRM, etc.)", valor: 189, forma: "Cartão Crédito", impacto: "Importante", geraReceita: true },
  { dia: 28, descricao: "Pró-labore", categoria: "Despesa Fixa", tipoSaida: "Pró-labore (Dono)", valor: 3500, forma: "Pix", impacto: "Essencial", geraReceita: false, responsavel: "Pessoal" },
  { dia: 30, descricao: "Comissão dos barbeiros (2ª quinzena)", categoria: "Custo Operacional", tipoSaida: "Terceirização operacional", valor: 7000, forma: "Pix", impacto: "Essencial", geraReceita: true },
];

export interface DadosFinanceiros {
  contasBancarias: ContaBancaria[];
  lancamentos: Lancamento[];
  contasPrevistas: ContaPrevista[];
}

export function gerarExemplo(hojeDate: Date, lojaId: string): DadosFinanceiros {
  const seed = hash(lojaId || "loja");
  const fator = 0.85 + (seed % 300) / 1000;
  const hoje = isoDate(hojeDate);
  let n = 0;

  const contasBancarias: ContaBancaria[] = [
    { nome: "Nubank PJ", tipo: "Conta digital", saldoInicial: Math.round(11100 * fator) },
    { nome: "Maquininha", tipo: "Maquininha / Recebíveis", saldoInicial: 0 },
    { nome: "Dinheiro em espécie", tipo: "Caixa físico", saldoInicial: 600 },
  ];
  const hojeMeiaNoite = new Date(hojeDate.getFullYear(), hojeDate.getMonth(), hojeDate.getDate()).getTime();
  const ehCartao = (forma: string) => forma.startsWith("Cartão");
  // Cartão cai no banco em 2 dias; dinheiro da gaveta é depositado depois de uma semana.
  const contaDe = (forma: string, diasAtras: number) =>
    ehCartao(forma)
      ? diasAtras < 2 ? "Maquininha" : "Nubank PJ"
      : forma === "Dinheiro" && diasAtras < 7
        ? "Dinheiro em espécie"
        : "Nubank PJ";
  const lancamentos: Lancamento[] = [];
  const contasPrevistas: ContaPrevista[] = [];

  function gerarMes(ano: number, mes: number, ateDia: number) {
    const ultimo = diasNoMes(ano, mes);
    for (let d = 1; d <= ateDia; d++) {
      const date = new Date(ano, mes, d);
      const data = isoDate(date);
      const dow = date.getDay();
      if (dow === 0) continue;
      const diasAtras = Math.round((hojeMeiaNoite - date.getTime()) / 86400000);
      const r = rng(seed + (mes + 1) * 1000 + d * 97);
      const base = dow === 6 ? 40 : dow === 5 ? 34 : dow === 1 ? 18 : 26;
      const qtd = Math.round(base * fator * (0.85 + r() * 0.3));
      for (let i = 0; i < qtd; i++) {
        const [categoria, item, preco] = SERVICOS[Math.floor(r() * SERVICOS.length)];
        const forma = pick(r, [["Pix", 42], ["Cartão Débito", 20], ["Cartão Crédito", 18], ["Dinheiro", 20]]);
        lancamentos.push({
          id: `ex-${n++}`,
          tipo: "entrada",
          data,
          categoria,
          item,
          cliente: CLIENTES[Math.floor(r() * CLIENTES.length)],
          descricao: "",
          valorCobranca: preco,
          taxa: taxaCartao(forma, preco) ?? 0,
          forma,
          canal: pick(r, [["Recorrência", 45], ["Indicação", 20], ["Redes Sociais", 14], ["Balcão", 10], ["Plataformas", 6], ["Tráfego Pago", 5]]),
          conta: contaDe(forma, diasAtras),
          exemplo: true,
        });
      }
      if (dow === 2 || dow === 5) {
        lancamentos.push({
          id: `ex-${n++}`,
          tipo: "saida",
          dataVencimento: data,
          dataPagamento: data,
          descricao: dow === 2 ? "Lâminas, toalhas e álcool" : "Pomadas e shampoo para revenda",
          categoria: "Custo Operacional",
          tipoSaida: dow === 2 ? "Insumos diretos" : "Matéria-prima",
          valorConta: Math.round((dow === 2 ? 180 : 420) * fator),
          juros: 0,
          forma: "Pix",
          conta: "Nubank PJ",
          responsavel: "Empresa",
          impacto: "Essencial",
          geraReceita: true,
          parcela: "",
          exemplo: true,
        });
      }
    }

    for (const p of PAGAMENTOS_FIXOS) {
      if (p.dia > ultimo) continue;
      const venc = isoDate(new Date(ano, mes, p.dia));
      const valor = Math.round(p.valor * (p.valor > 1000 ? fator : 1));
      if (p.dia <= ateDia) {
        lancamentos.push({
          id: `ex-${n++}`,
          tipo: "saida",
          dataVencimento: venc,
          dataPagamento: venc,
          descricao: p.descricao,
          categoria: p.categoria,
          tipoSaida: p.tipoSaida,
          valorConta: valor,
          juros: 0,
          forma: p.forma,
          conta: "Nubank PJ",
          responsavel: p.responsavel ?? "Empresa",
          impacto: p.impacto,
          geraReceita: p.geraReceita,
          parcela: "",
          exemplo: true,
        });
      } else {
        contasPrevistas.push({ id: `cp-${n++}`, tipo: "pagar", vencimento: venc, descricao: p.descricao, valor, pago: false });
      }
    }
  }

  const ano = hojeDate.getFullYear();
  const mes = hojeDate.getMonth();
  const diaHoje = hojeDate.getDate();
  const anterior = new Date(ano, mes - 1, 1);
  gerarMes(anterior.getFullYear(), anterior.getMonth(), diasNoMes(anterior.getFullYear(), anterior.getMonth()));
  gerarMes(ano, mes, diaHoje);

  const ultimo = diasNoMes(ano, mes);
  for (let d = diaHoje + 1; d <= ultimo; d += 3) {
    contasPrevistas.push({
      id: `cr-${n++}`,
      tipo: "receber",
      vencimento: isoDate(new Date(ano, mes, d)),
      descricao: "Planos mensais (assinatura)",
      valor: Math.round(129.9 * (3 + (d % 4)) * 100) / 100,
      pago: false,
    });
  }

  const vencido = isoDate(new Date(ano, mes, diaHoje - 2));
  contasPrevistas.push(
    { id: `cr-${n++}`, tipo: "receber", vencimento: vencido, descricao: "Pacote corporativo — Studio Fit", valor: 1200, pago: false },
    { id: `cp-${n++}`, tipo: "pagar", vencimento: vencido, descricao: "Manutenção do ar-condicionado", valor: 450, pago: false }
  );

  const repasses: ContaPrevista[] = [];
  for (let d = diaHoje + 1; d <= ultimo; d++) {
    const date = new Date(ano, mes, d);
    if (date.getDay() === 0) continue;
    repasses.push({ id: `cr-${n++}`, tipo: "receber", vencimento: isoDate(date), descricao: "Repasse da maquininha", valor: Math.round(520 * fator), pago: false });
  }
  contasPrevistas.push(...repasses);

  // Calibra a projeção para que o dia mais apertado fique um pouco abaixo do caixa mínimo,
  // que é o cenário que o Controle de Necessidade existe para mostrar.
  const alvo = 9850;
  const inicioMes = isoDate(new Date(ano, mes, 1));
  const real = calcRealizado(lancamentos, saldoAntesDe(contasBancarias, lancamentos, inicioMes), ano, mes, diaHoje);
  const saldoHoje = real[real.length - 1].saldoFinal;
  for (let i = 0; i < 6; i++) {
    const proj = calcProjecao(contasPrevistas, saldoHoje, hoje, ano, mes);
    if (proj.length === 0) break;
    const min = proj.reduce((m, p) => (p.saldoProjetado < m.saldoProjetado ? p : m), proj[0]);
    const diff = min.saldoProjetado - alvo;
    if (Math.abs(diff) < 1) break;
    const antes = repasses.filter((r) => r.vencimento <= min.data);
    if (diff < 0 && antes.length > 0) {
      const extra = -diff / antes.length;
      antes.forEach((r) => (r.valor = Math.round((r.valor + extra) * 100) / 100));
    } else if (diff > 0) {
      contasPrevistas.push({ id: `cp-${n++}`, tipo: "pagar", vencimento: min.data, descricao: "Fornecedor — compra de estoque", valor: Math.round(diff * 100) / 100, pago: false });
      break;
    } else {
      break;
    }
  }

  return { contasBancarias, lancamentos, contasPrevistas };
}
