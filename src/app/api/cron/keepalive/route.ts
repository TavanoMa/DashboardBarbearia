import { NextRequest, NextResponse } from "next/server";
import { keepAliveSessions } from "@/lib/appbarber-auth";

/**
 * GET /api/cron/keepalive
 *
 * Called by Vercel Cron (or manually) to keep PHP sessions alive.
 * Pings each store's AppBarber session so it doesn't expire.
 *
 * Vercel cron config in vercel.json:
 * see vercel.json for schedule (every 10 minutes)
 */
export async function GET(request: NextRequest) {
  // Optional: verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await keepAliveSessions();

    const allActive = results.every((r) => r.status === "active");
    const deadStores = results.filter((r) => r.status === "dead");
    const unboundStores = results.filter((r) => r.status === "alive");
    const reauthedStores = results.filter((r) => r.reauthed);

    return NextResponse.json({
      ok: allActive,
      timestamp: new Date().toISOString(),
      stores: results,
      ...(reauthedStores.length > 0 && {
        reauthed: `Sessões re-autenticadas automaticamente: ${reauthedStores.map((s) => s.name).join(", ")}`,
      }),
      ...(deadStores.length > 0 && {
        warning: `Sessões expiradas (reauth falhou): ${deadStores.map((s) => s.name).join(", ")}. Reconfigure em /configuracoes`,
      }),
      ...(unboundStores.length > 0 && {
        notice: `Sessões sem dados (reauth falhou): ${unboundStores.map((s) => s.name).join(", ")}. Reconfigure em /configuracoes`,
      }),
    });
  } catch (err) {
    console.error("Keepalive error:", err);
    return NextResponse.json(
      { error: "Erro no keepalive", details: String(err) },
      { status: 500 }
    );
  }
}
