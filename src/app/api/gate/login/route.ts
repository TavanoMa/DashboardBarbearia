import { NextRequest, NextResponse } from "next/server";
import { assinarToken, senhaCorreta, GATE_COOKIE } from "@/lib/gate";

export async function POST(request: NextRequest) {
  if (!process.env.APP_PASSWORD) {
    return NextResponse.json(
      { error: "APP_PASSWORD não configurado no servidor." },
      { status: 500 }
    );
  }

  let senha = "";
  try {
    const body = await request.json();
    senha = typeof body?.senha === "string" ? body.senha : "";
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!senhaCorreta(senha)) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  const token = await assinarToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  return res;
}
