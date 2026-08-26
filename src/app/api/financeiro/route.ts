import { NextRequest, NextResponse } from "next/server";
import { buscarFinanceiroResumo, buscarFinanceiroGrafico, buscarFluxoCaixa, isSessionConfigured } from "@/lib/appbarber";
import { parseFinanceiroResumo, parseFinanceiroTransacoes, parseComandas, parseFormasPagamentoResumo, parseMoneyBR } from "@/lib/parser";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const store = searchParams.get("store") || undefined;

  if (!isSessionConfigured(store)) {
    return NextResponse.json({ error: "Sessão não configurada" }, { status: 401 });
  }

  const dataIni = searchParams.get("dataIni");
  const dataFim = searchParams.get("dataFim");

  const hoje = new Date();
  const inicio = dataIni ? parseDate(dataIni) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = dataFim ? parseDate(dataFim) : hoje;

  try {
    const [resumoRaw, transacoesRaw, formasPgtoRaw, comandasRaw, dashboardGeralRaw, grafico] = await Promise.all([
      buscarFinanceiroResumo(inicio, fim, 1, undefined, store),
      buscarFinanceiroResumo(inicio, fim, 3, undefined, store),
      buscarFinanceiroResumo(inicio, fim, 6, undefined, store),
      buscarFluxoCaixa(inicio, fim, 4, store),
      buscarFluxoCaixa(inicio, fim, 1, store),
      buscarFinanceiroGrafico(inicio, fim, store),
    ]);

    const resumo = parseFinanceiroResumo(resumoRaw);
    const transacoes = parseFinanceiroTransacoes(transacoesRaw);
    const formasPagamento = parseFormasPagamentoResumo(formasPgtoRaw);
    const comandas = parseComandas(comandasRaw);

    const dgRaw = dashboardGeralRaw?.[0] as Record<string, string> | undefined;
    const dashboardGeral = dgRaw
      ? {
          totalBruto: parseMoneyBR(dgRaw.TotalBruto),
          totalBrutoReal: parseMoneyBR(dgRaw.TotalBrutoReal),
        }
      : null;

    return NextResponse.json({
      resumo,
      transacoes,
      formasPagamento,
      comandas,
      dashboardGeral,
      grafico: grafico.data,
    });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar dados financeiros" }, { status: 500 });
  }
}

function parseDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
