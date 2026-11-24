import { NextResponse, type NextRequest } from "next/server";
import { verificarToken, GATE_COOKIE } from "@/lib/gate";

// Rotas públicas (nunca passam pelo portão).
// A extensão do Chrome usa /api/auth/sync-cookie e /api/auth/status sem cookie
// do dashboard — o sync-cookie tem seu próprio x-sync-token; o status só lista
// nomes de loja (nada sensível), então pode ficar aberto.
const PUBLICAS = [
  "/entrar",
  "/api/gate/login",
  "/api/gate/logout",
  "/api/auth/sync-cookie",
  "/api/auth/status",
];

function ehPublica(path: string): boolean {
  return PUBLICAS.some((p) => path === p || path.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (ehPublica(pathname)) return NextResponse.next();

  const token = request.cookies.get(GATE_COOKIE)?.value;
  const ok = await verificarToken(token);
  if (ok) return NextResponse.next();

  // API bloqueada → 401 JSON (não redireciona, pra não confundir fetch do cliente)
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Página → manda pro /entrar guardando o destino original
  const url = request.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Pula assets estáticos, imagens otimizadas, favicon, robots.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|robots.txt|sitemap.xml).*)"],
};
