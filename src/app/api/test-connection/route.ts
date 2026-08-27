import { NextRequest, NextResponse } from "next/server";
import { buscarAgendamentosRaw, isSessionConfigured } from "@/lib/appbarber";
import { parseAgendamentos } from "@/lib/parser";

export async function GET(request: NextRequest) {
  const store = request.nextUrl.searchParams.get("store") || undefined;

  if (!(await isSessionConfigured(store))) {
    return NextResponse.json({
      connected: false,
      error: "Sessão não configurada",
    });
  }

  try {
    const hoje = new Date();
    const raw = await buscarAgendamentosRaw(hoje, hoje, undefined, store);
    const agendamentos = parseAgendamentos(raw);

    return NextResponse.json({
      connected: true,
      count: agendamentos.length,
      raw: raw.length,
    });
  } catch {
    return NextResponse.json({
      connected: false,
      error: "Erro ao conectar",
    });
  }
}
