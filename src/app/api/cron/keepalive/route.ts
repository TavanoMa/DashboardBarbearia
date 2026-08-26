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

    const allAlive = results.every((r) => r.alive);
    const deadStores = results.filter((r) => !r.alive);

    return NextResponse.json({
      ok: allAlive,
      timestamp: new Date().toISOString(),
      stores: results,
      ...(deadStores.length > 0 && {
        warning: `Sessões expiradas: ${deadStores.map((s) => s.name).join(", ")}`,
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
