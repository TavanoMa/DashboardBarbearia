import { NextRequest, NextResponse } from "next/server";
import {
  getAllCredentials,
  loadSessionsFresh,
  saveSessions,
  discoverEstablishments,
  authenticateEstablishment,
  probeSession,
  type StoreSessions,
} from "@/lib/appbarber-auth";

/**
 * POST /api/auth/reconnect
 *
 * Reconecta UMA loja usando as credenciais já salvas no KV.
 * O cliente envia um token reCAPTCHA v3 fresco, gerado no navegador dele —
 * esse é o truque que faz a reconexão funcionar: o token vem de um IP real,
 * de um navegador real, e o reCAPTCHA v3 aprova. Nenhum dado volta pro navegador:
 * só grava o cookie novo no KV, do lado do servidor.
 *
 * Body: { storeId: string, recaptchaToken: string }
 */
export async function POST(request: NextRequest) {
  let body: { storeId?: string; recaptchaToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { storeId, recaptchaToken } = body;
  if (!storeId || !recaptchaToken) {
    return NextResponse.json(
      { error: "storeId e recaptchaToken são obrigatórios" },
      { status: 400 }
    );
  }

  // Precisa da loja já cadastrada (pra saber o establishmentCode ou nome pra bater)
  const sessions = await loadSessionsFresh();
  const existente = sessions.find((s) => s.id === storeId);
  if (!existente) {
    return NextResponse.json(
      { error: `Loja "${storeId}" não está cadastrada` },
      { status: 404 }
    );
  }

  // Precisa de credencial salva
  const allCreds = await getAllCredentials();
  if (allCreds.length === 0) {
    return NextResponse.json(
      {
        error:
          "Sem credenciais salvas. Faça o login completo abaixo primeiro — depois o botão de reconectar funciona.",
      },
      { status: 400 }
    );
  }

  // Escolhe a credencial: preferencialmente a que lista essa loja; senão a primeira.
  const cred =
    allCreds.find((c) => c.storeIds.includes(storeId)) || allCreds[0];

  // Já temos establishmentCode? Vai direto pro login da loja.
  if (existente.establishmentCode) {
    const r = await authenticateEstablishment(
      cred.email,
      cred.password,
      existente.establishmentCode,
      recaptchaToken
    );
    if (!r.success || !r.phpSessionId) {
      return NextResponse.json(
        { error: `Falha ao autenticar: ${r.error || "sem detalhe"}` },
        { status: 502 }
      );
    }
    const ok = (await probeSession(r.phpSessionId)).status === "active";
    if (!ok) {
      return NextResponse.json(
        { error: "O login passou mas a sessão nova não trouxe dados da loja." },
        { status: 502 }
      );
    }
    await atualizarSessao(sessions, existente, r.phpSessionId);
    return NextResponse.json({ success: true, storeId, name: existente.name });
  }

  // Não tem establishmentCode → descobre primeiro.
  const disc = await discoverEstablishments(cred.email, cred.password, recaptchaToken);
  if (!disc.success) {
    return NextResponse.json(
      { error: disc.error || "Falha na descoberta" },
      { status: 502 }
    );
  }

  // Loja única (sem lista de estabelecimentos): usa a sessão direto.
  if (disc.singleSession) {
    const ok = (await probeSession(disc.singleSession.phpSessionId)).status === "active";
    if (!ok) {
      return NextResponse.json(
        { error: "Sessão nova sem dados da loja." },
        { status: 502 }
      );
    }
    await atualizarSessao(sessions, existente, disc.singleSession.phpSessionId);
    return NextResponse.json({ success: true, storeId, name: existente.name });
  }

  // Lista de estabelecimentos → acha o certo e autentica.
  const match = (disc.establishments || []).find(
    (e) =>
      slug(e.name) === slug(storeId) ||
      slug(e.name).includes(slug(existente.name)) ||
      slug(existente.name).includes(slug(e.name))
  );
  if (!match) {
    return NextResponse.json(
      {
        error: `Loja "${existente.name}" não encontrada entre: ${(disc.establishments || [])
          .map((e) => e.name)
          .join(", ")}`,
      },
      { status: 502 }
    );
  }

  const r = await authenticateEstablishment(
    cred.email,
    cred.password,
    match.code,
    recaptchaToken
  );
  if (!r.success || !r.phpSessionId) {
    return NextResponse.json(
      { error: `Falha ao autenticar: ${r.error || "sem detalhe"}` },
      { status: 502 }
    );
  }
  const ok = (await probeSession(r.phpSessionId)).status === "active";
  if (!ok) {
    return NextResponse.json(
      { error: "O login passou mas a sessão nova não trouxe dados da loja." },
      { status: 502 }
    );
  }

  // Grava, também preenchendo o establishmentCode agora que conhecemos
  await atualizarSessao(sessions, existente, r.phpSessionId, match.code);
  return NextResponse.json({ success: true, storeId, name: existente.name });
}

async function atualizarSessao(
  sessions: StoreSessions[],
  existente: StoreSessions,
  phpSessionId: string,
  establishmentCode?: string
) {
  // Lê de novo o estado atual do KV e grava só a loja em questão — assim não
  // sobrescreve por cima de outra reconexão que tenha rodado em paralelo.
  const now = Date.now();
  const latest = await loadSessionsFresh();
  const fresh: StoreSessions = {
    ...existente,
    phpSessionId,
    lastVerified: now,
    lastStatus: "active",
    statusSince: now,
    ...(establishmentCode ? { establishmentCode } : {}),
  };
  const idx = latest.findIndex((s) => s.id === existente.id);
  const merged =
    idx === -1 ? [...latest, fresh] : latest.map((s, i) => (i === idx ? fresh : s));
  await saveSessions(merged);
  // uso: só pra garantir que o linter não reclame do parâmetro
  void sessions;
}

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
