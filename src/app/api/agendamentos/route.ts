import { NextRequest, NextResponse } from "next/server";
import { buscarAgendamentosRaw } from "@/lib/appbarber";
import { parseAgendamentos } from "@/lib/parser";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dataIni = searchParams.get("dataIni");
  const dataFim = searchParams.get("dataFim");
  const store = searchParams.get("store") || undefined;

  const hoje = new Date();
  const inicio = dataIni ? parseDate(dataIni) : hoje;
  const fim = dataFim ? parseDate(dataFim) : hoje;

  const raw = await buscarAgendamentosRaw(inicio, fim, undefined, store);
  const agendamentos = parseAgendamentos(raw);

  return NextResponse.json(agendamentos);
}

function parseDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
