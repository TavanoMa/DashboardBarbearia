import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const CONFIG_PATH = join(process.cwd(), ".appbarber.json");

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function applyConfig(config: { phpSessionId: string; appblzId?: string }) {
  process.env.APPBARBER_PHPSESSID = config.phpSessionId;
  process.env.APPBARBER_APPBLZ_ID = config.appblzId || "";
}

const existing = loadConfig();
if (existing?.phpSessionId) applyConfig(existing);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { phpSessionId, appblzId } = body;

  const config = { phpSessionId, appblzId: appblzId || "" };
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  applyConfig(config);

  return NextResponse.json({ success: true });
}

export async function GET() {
  const config = loadConfig();
  return NextResponse.json({
    configured: !!config?.phpSessionId,
    hasAppblz: !!config?.appblzId,
  });
}
