import { NextRequest, NextResponse } from "next/server";
import {
  getActiveSessions,
  mergeAndSaveSessions,
  saveSessions,
  getCredentials,
  type StoreSessions,
} from "@/lib/appbarber-auth";

/**
 * GET /api/config
 * Returns list of configured stores (id + name only, no secrets).
 */
export async function GET() {
  const sessions = await getActiveSessions();
  const credentials = await getCredentials();

  return NextResponse.json({
    configured: sessions.length > 0 && !!sessions[0]?.phpSessionId,
    hasCredentials: !!credentials,
    stores: sessions.map((s) => ({ id: s.id, name: s.name })),
  });
}

/**
 * POST /api/config
 * Save store sessions manually (cookie-based setup).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Multi-store save — merge with existing so we don't wipe other stores
    if (body.stores && Array.isArray(body.stores)) {
      const stores: StoreSessions[] = body.stores.map(
        (s: { id: string; name: string; phpSessionId: string; appblzId?: string }) => ({
          id: s.id,
          name: s.name,
          phpSessionId: s.phpSessionId,
          appblzId: s.appblzId || "",
          lastVerified: Date.now(),
        })
      );
      await mergeAndSaveSessions(stores);
      return NextResponse.json({ success: true });
    }

    // Legacy single-store save — also merges to preserve other stores
    const { phpSessionId, appblzId, storeId, storeName } = body;
    if (!phpSessionId) {
      return NextResponse.json({ error: "phpSessionId obrigatório" }, { status: 400 });
    }

    const id = storeId || "default";
    const name = storeName || "Loja Padrão";
    const newStore: StoreSessions = {
      id,
      name,
      phpSessionId,
      appblzId: appblzId || "",
      lastVerified: Date.now(),
    };

    await mergeAndSaveSessions([newStore]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Config save error:", err);
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }
}

/**
 * DELETE /api/config?store=<storeId>
 * Remove a specific store session from KV.
 */
export async function DELETE(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("store");
  if (!storeId) {
    return NextResponse.json({ error: "Parâmetro ?store= obrigatório" }, { status: 400 });
  }

  try {
    const sessions = await getActiveSessions();
    const filtered = sessions.filter((s) => s.id !== storeId);

    if (filtered.length === sessions.length) {
      return NextResponse.json({ error: `Loja "${storeId}" não encontrada` }, { status: 404 });
    }

    await saveSessions(filtered);
    return NextResponse.json({
      success: true,
      removed: storeId,
      remaining: filtered.map((s) => ({ id: s.id, name: s.name })),
    });
  } catch (err) {
    console.error("Config delete error:", err);
    return NextResponse.json({ error: "Erro ao remover" }, { status: 500 });
  }
}
