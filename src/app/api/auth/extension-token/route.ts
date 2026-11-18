import { NextResponse } from "next/server";

/**
 * GET /api/auth/extension-token
 *
 * Retorna só se o token da extensão está configurado no servidor e, em caso
 * positivo, o próprio token (o dashboard não tem autenticação ainda, então isso
 * aparece pra quem quiser olhar — proteja a URL do dashboard se isso te
 * incomodar). Nenhum segredo "forte" aqui: o token só serve pra manter
 * extensões não autorizadas fora, não pra proteger dados financeiros.
 */
export async function GET() {
  const token = process.env.EXTENSION_SYNC_TOKEN;
  if (!token) {
    return NextResponse.json({ configured: false });
  }
  return NextResponse.json({ configured: true, token });
}
