import { NextRequest, NextResponse } from "next/server";
import { keepAliveSessions } from "@/lib/appbarber-auth";

/**
 * GET /api/cron/keepalive
 *
 * Called by external cron (cron-job.org every 5 min) to keep PHP sessions alive.
 * Returns 503 when any session is down so cron-job.org sends email alert.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await keepAliveSessions();

    if (results.length === 0) {
      return NextResponse.json(
        { ok: false, v: 5, timestamp: new Date().toISOString(), error: "Nenhuma loja configurada" },
        { status: 503 }
      );
    }

    const allActive = results.every((r) => r.status === "active");
    const deadStores = results.filter((r) => r.status === "dead");
    const unboundStores = results.filter((r) => r.status === "alive");
    const reauthedStores = results.filter((r) => r.reauthed);
    const failedStores = [...deadStores, ...unboundStores];

    const body = {
      ok: allActive,
      v: 5,
      timestamp: new Date().toISOString(),
      stores: results,
      ...(reauthedStores.length > 0 && {
        reauthed: `Sessões re-autenticadas: ${reauthedStores.map((s) => s.name).join(", ")}`,
      }),
      ...(failedStores.length > 0 && {
        alert: `SESSÃO CAIU: ${failedStores.map((s) => `${s.name} (${s.status})`).join(", ")}. Reconfigure em /configuracoes`,
      }),
    };

    // Return 503 when any session is not active — triggers cron-job.org email alert
    if (!allActive) {
      return NextResponse.json(body, { status: 503 });
    }

    return NextResponse.json(body);
  } catch (err) {
    console.error("Keepalive error:", err);
    return NextResponse.json(
      { error: "Erro no keepalive", details: String(err) },
      { status: 500 }
    );
  }
}
