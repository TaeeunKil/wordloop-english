import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "@/lib/env";
import { serverClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const config = getConfig();
  if (!config) return NextResponse.redirect(new URL("/setup", request.url));
  const code = request.nextUrl.searchParams.get("code");
  const client = await serverClient();
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/dashboard", config.site));
  }
  return NextResponse.redirect(new URL("/?auth=failed", config.site));
}
