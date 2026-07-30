import { NextResponse } from "next/server";
import { buscarAgendamentosRaw, isSessionConfigured } from "@/lib/appbarber";
import { parseAgendamentos } from "@/lib/parser";

export async function GET() {
  if (!isSessionConfigured()) {
    return NextResponse.json({
      connected: false,
      error: "Sessão não configurada",
    });
  }

  try {
    const hoje = new Date();
    const raw = await buscarAgendamentosRaw(hoje, hoje);
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
