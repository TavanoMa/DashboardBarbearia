import { NextResponse } from "next/server";
import { buscarResumoDashboard, isSessionConfigured } from "@/lib/appbarber";

export async function GET() {
  if (!isSessionConfigured()) {
    return NextResponse.json({ error: "Sessao nao configurada" }, { status: 401 });
  }

  try {
    const raw = await buscarResumoDashboard();
    const row = (raw?.[0] ?? {}) as Record<string, string>;

    const toInt = (v: string | undefined) => parseInt(v || "0", 10) || 0;

    return NextResponse.json({
      totalComandaPendentes: toInt(row.TotalComandaPendentes),
      totalClienteDebito: toInt(row.TotalClienteDebito),
      totalClienteCredito: toInt(row.TotalClienteCredito),
      totalCaixaPendente: toInt(row.TotalCaixaPendente),
      totalClientesSemUsuario: toInt(row.TotalClientesSemUsuario),
      totalRetorno: toInt(row.TotalRetorno),
      totalContasReceber: toInt(row.TotalContasReceber),
      totalContasPagar: toInt(row.TotalContasPagar),
      totalClientesSemVir: toInt(row.TotalClientesSemVir),
      totalUsuariosConectaramApp: toInt(row.TotalUsuariosConectaramApp),
      totalClienteNovo: toInt(row.TotalClienteNovo),
      totalProdVencer: toInt(row.TotalProdVencer),
      totalAtrasada: toInt(row.TotalAtrasada),
      totalAssinatura: toInt(row.TotalAssinatura),
    });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar resumo" }, { status: 500 });
  }
}
