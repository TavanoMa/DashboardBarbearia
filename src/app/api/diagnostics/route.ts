import { NextResponse } from "next/server";
import { getKeepAliveLog, getActiveSessions } from "@/lib/appbarber-auth";

/**
 * GET /api/diagnostics
 *
 * Returns keepalive log history showing when sessions changed status.
 * Also shows current session state (masked) for debugging.
 */
export async function GET() {
  try {
    const log = await getKeepAliveLog();
    const sessions = await getActiveSessions();

    // Find status transitions
    const transitions = log
      .flatMap((entry) =>
        entry.stores
          .filter((s) => s.changed)
          .map((s) => ({
            timestamp: entry.timestamp,
            store: s.name,
            from: s.prevStatus,
            to: s.status,
          }))
      );

    // Session debug info (masked for security)
    const sessionDebug = sessions.map((s) => ({
      id: s.id,
      name: s.name,
      phpSessionId: s.phpSessionId
        ? `${s.phpSessionId.slice(0, 6)}...${s.phpSessionId.slice(-4)} (len=${s.phpSessionId.length})`
        : "(empty)",
      appblzId: s.appblzId || "(empty)",
      lastVerified: s.lastVerified
        ? new Date(s.lastVerified).toISOString()
        : "(never)",
      sessionsSame: false, // filled below
    }));

    // Check if sessions are duplicated
    if (sessionDebug.length >= 2) {
      const ids = sessions.map((s) => s.phpSessionId);
      const allSame = ids.every((id) => id === ids[0]);
      sessionDebug.forEach((s) => (s.sessionsSame = allSame));
    }

    return NextResponse.json({
      totalEntries: log.length,
      sessions: sessionDebug,
      transitions,
      recentHistory: log.slice(-20),
    });
  } catch (err) {
    console.error("Diagnostics error:", err);
    return NextResponse.json(
      { error: "Erro ao buscar diagnósticos" },
      { status: 500 }
    );
  }
}
