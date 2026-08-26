import { NextRequest, NextResponse } from "next/server";
import {
  discoverEstablishments,
  authenticateEstablishment,
  mergeAndSaveSessions,
  slugify,
  type StoreSessions,
} from "@/lib/appbarber-auth";

/**
 * POST /api/auth/login
 *
 * Step 1 — Discover: { email, password, recaptchaToken }
 *   → Returns { establishments: [...] } or { authenticated: true } (single store)
 *
 * Step 2 — Authenticate: { email, password, recaptchaToken, establishments: [{code,name},...] }
 *   → Creates separate sessions for each establishment, saves config
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, recaptchaToken, establishments } = body;

    if (!email || !password || !recaptchaToken) {
      return NextResponse.json(
        { error: "Email, senha e token reCAPTCHA são obrigatórios" },
        { status: 400 }
      );
    }

    // Step 2: Authenticate to specific establishments
    if (establishments && Array.isArray(establishments) && establishments.length > 0) {
      const sessions: StoreSessions[] = [];
      const errors: string[] = [];

      // Authenticate each establishment with a separate session
      for (const est of establishments) {
        const result = await authenticateEstablishment(
          email,
          password,
          est.code,
          recaptchaToken
        );

        if (result.success && result.phpSessionId) {
          sessions.push({
            id: slugify(est.name),
            name: est.name,
            phpSessionId: result.phpSessionId,
            appblzId: "", // Not needed — session is already bound to establishment
            lastVerified: Date.now(),
          });
        } else {
          errors.push(`${est.name}: ${result.error || "Falha"}`);
        }
      }

      if (sessions.length > 0) {
        // Merge with existing sessions (from other logins) + save credentials
        await mergeAndSaveSessions(sessions, { email, password });

        return NextResponse.json({
          authenticated: true,
          stores: sessions.map((s) => ({ id: s.id, name: s.name })),
          errors: errors.length > 0 ? errors : undefined,
        });
      }

      return NextResponse.json(
        { error: "Nenhuma loja autenticada", details: errors },
        { status: 401 }
      );
    }

    // Step 1: Discover establishments
    const discovery = await discoverEstablishments(email, password, recaptchaToken);

    if (!discovery.success) {
      return NextResponse.json(
        { error: discovery.error || "Falha na autenticação" },
        { status: 401 }
      );
    }

    // Multiple establishments — return list for selection
    if (discovery.establishments && discovery.establishments.length > 0) {
      return NextResponse.json({
        needsSelection: true,
        establishments: discovery.establishments,
      });
    }

    // Single establishment — already authenticated
    if (discovery.singleSession) {
      const sessions: StoreSessions[] = [
        {
          id: "default",
          name: "Loja Principal",
          phpSessionId: discovery.singleSession.phpSessionId,
          appblzId: "",
          lastVerified: Date.now(),
        },
      ];
      await mergeAndSaveSessions(sessions, { email, password });

      return NextResponse.json({
        authenticated: true,
        stores: [{ id: "default", name: "Loja Principal" }],
      });
    }

    return NextResponse.json(
      { error: "Resposta inesperada" },
      { status: 500 }
    );
  } catch (err) {
    console.error("Auth login error:", err);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
