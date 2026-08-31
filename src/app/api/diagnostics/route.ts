import { NextResponse } from "next/server";
import { getKeepAliveLog } from "@/lib/appbarber-auth";

/**
 * GET /api/diagnostics
 *
 * Returns keepalive log history showing when sessions changed status.
 * Helps diagnose why a session lost its establishment binding.
 */
export async function GET() {
  try {
    const log = await getKeepAliveLog();

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

    return NextResponse.json({
      totalEntries: log.length,
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
