import { NextRequest, NextResponse } from "next/server";
import { keepAliveSessions } from "@/lib/appbarber-auth";

// Cada loja pode levar até 3 tentativas de 8s (em paralelo entre as lojas).
export const maxDuration = 60;

/**
 * Por quanto tempo uma queda devolve 503.
 *
 * O 503 existe para o cron externo (cron-job.org / UptimeRobot) mandar o email
 * de alerta. Mas esses serviços DESATIVAM o job depois de muitas falhas
 * seguidas — e aí o ping para, e as sessões que forem consertadas depois
 * expiram por inatividade sem ninguém avisar. Por isso o 503 só dura a
 * primeira meia hora da queda; depois volta 200 com ok:false no corpo.
 */
const ALERT_WINDOW_MS = 30 * 60 * 1000;

/**
 * GET /api/cron/keepalive
 *
 * Chamado pelo cron externo a cada 5 min. Faz uma requisição com o cookie de
 * cada loja — é isso que impede o AppBarber de expirar a sessão por inatividade.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await keepAliveSessions();
    const now = Date.now();

    if (results.length === 0) {
      return NextResponse.json(
        { ok: false, v: 6, timestamp: new Date(now).toISOString(), error: "Nenhuma loja configurada" },
        { status: 503 }
      );
    }

    const down = results.filter((r) => r.status !== "active");
    const downSince = down.length > 0 ? Math.min(...down.map((r) => r.statusSince)) : null;
    const alerting = downSince !== null && now - downSince < ALERT_WINDOW_MS;

    const body = {
      ok: down.length === 0,
      v: 6,
      timestamp: new Date(now).toISOString(),
      stores: results.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        alive: r.alive,
        since: new Date(r.statusSince).toISOString(),
        ...(r.reason ? { reason: r.reason } : {}),
      })),
      ...(down.length > 0 && {
        alert: `SESSÃO CAIU: ${down
          .map((s) => `${s.name} (${s.status}${s.reason ? ` — ${s.reason}` : ""})`)
          .join(", ")}. Reconfigure em /configuracoes`,
      }),
    };

    return NextResponse.json(body, { status: alerting ? 503 : 200 });
  } catch (err) {
    console.error("Keepalive error:", err);
    return NextResponse.json(
      { error: "Erro no keepalive", details: String(err) },
      { status: 500 }
    );
  }
}
