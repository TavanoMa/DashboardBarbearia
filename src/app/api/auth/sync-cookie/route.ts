import { NextRequest, NextResponse } from "next/server";
import {
  loadSessionsFresh,
  saveSessions,
  probeSession,
  type StoreSessions,
} from "@/lib/appbarber-auth";

/**
 * POST /api/auth/sync-cookie
 *
 * Recebe o cookie PHPSESSID da extensão de navegador do cliente e grava no KV.
 * Como o cookie veio do browser real (IP residencial, reCAPTCHA já aprovado no
 * login manual que ele fez), aqui a gente só valida com um probe e salva.
 *
 * Auth: header `x-sync-token` tem que bater com process.env.EXTENSION_SYNC_TOKEN.
 * Body: { storeId: string, phpSessionId: string, source?: string }
 */
export async function POST(request: NextRequest) {
  const expected = process.env.EXTENSION_SYNC_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Servidor sem EXTENSION_SYNC_TOKEN configurado" },
      { status: 500 }
    );
  }
  const got = request.headers.get("x-sync-token");
  if (got !== expected) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  let body: { storeId?: string; phpSessionId?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { storeId, phpSessionId } = body;
  if (!storeId || !phpSessionId) {
    return NextResponse.json(
      { error: "storeId e phpSessionId são obrigatórios" },
      { status: 400 }
    );
  }

  const sessions = await loadSessionsFresh();
  const alvo = sessions.find((s) => s.id === storeId);
  if (!alvo) {
    return NextResponse.json(
      {
        error: `Loja "${storeId}" não cadastrada. Lojas conhecidas: ${sessions
          .map((s) => s.id)
          .join(", ") || "(nenhuma)"}`,
      },
      { status: 404 }
    );
  }

  // Se o cookie já é o mesmo que está no KV, não gasta probe nem grava.
  if (alvo.phpSessionId === phpSessionId) {
    return NextResponse.json({
      ok: true,
      storeId,
      storeName: alvo.name,
      unchanged: true,
    });
  }

  // Valida o cookie novo antes de gravar — evita trocar um cookie bom por lixo.
  const probe = await probeSession(phpSessionId);
  if (probe.status === "dead") {
    return NextResponse.json(
      { error: `Cookie rejeitado pelo AppBarber: ${probe.reason || "sem detalhe"}` },
      { status: 502 }
    );
  }

  const now = Date.now();
  const atualizado: StoreSessions = {
    ...alvo,
    phpSessionId,
    lastVerified: now,
    lastStatus: probe.status,
    statusSince: alvo.lastStatus === probe.status ? alvo.statusSince || now : now,
  };

  // Relê o KV antes de gravar pra não estourar outra reconexão concorrente.
  const latest = await loadSessionsFresh();
  const idx = latest.findIndex((s) => s.id === storeId);
  const merged =
    idx === -1 ? [...latest, atualizado] : latest.map((s, i) => (i === idx ? atualizado : s));
  await saveSessions(merged);

  return NextResponse.json({
    ok: true,
    storeId,
    storeName: alvo.name,
    status: probe.status,
    warning: probe.status === "alive" ? probe.reason : undefined,
  });
}
