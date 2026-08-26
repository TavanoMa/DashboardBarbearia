import { NextRequest, NextResponse } from "next/server";
import { buscarComissoes, buscarComissoesSintetico, isSessionConfigured } from "@/lib/appbarber";
import { parseComissoes, parseComissoesSintetico, agruparComissoesPorProfissional } from "@/lib/parser";

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
    const [detalheRaw, sinteticoRaw] = await Promise.all([
      buscarComissoes(inicio, fim, undefined, store),
      buscarComissoesSintetico(inicio, fim, undefined, store),
    ]);

    const detalhe = parseComissoes(detalheRaw);
    const sintetico = parseComissoesSintetico(sinteticoRaw);
    const porProfissional = agruparComissoesPorProfissional(detalhe);

    return NextResponse.json({ detalhe, sintetico, porProfissional });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar comissões" }, { status: 500 });
  }
}

function parseDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
