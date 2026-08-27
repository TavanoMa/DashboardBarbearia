import { NextResponse } from "next/server";
import {
  getActiveSessions,
  testSession,
  getCredentials,
} from "@/lib/appbarber-auth";

/**
 * GET /api/auth/status
 *
 * Returns the connection status of each configured store.
 * status: "active" = session works with real data
 *         "alive"  = session responds but establishment may be unbound (empty data)
 *         "dead"   = session expired
 */
export async function GET() {
  try {
    const sessions = await getActiveSessions();
    const credentials = await getCredentials();

    if (sessions.length === 0) {
      return NextResponse.json({
        configured: false,
        hasCredentials: !!credentials,
        stores: [],
      });
    }

    // Test each session in parallel
    const storeStatuses = await Promise.all(
      sessions.map(async (store) => {
        const status = await testSession(store.phpSessionId);
        return {
          id: store.id,
          name: store.name,
          connected: status !== "dead",
          status,
          lastVerified: store.lastVerified
            ? new Date(store.lastVerified).toISOString()
            : null,
        };
      })
    );

    return NextResponse.json({
      configured: true,
      hasCredentials: !!credentials,
      stores: storeStatuses,
    });
  } catch (err) {
    console.error("Auth status error:", err);
    return NextResponse.json(
      { error: "Erro ao verificar status" },
      { status: 500 }
    );
  }
}
