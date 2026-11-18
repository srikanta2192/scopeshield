import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/app-url";

function safeNextPath(path: string | null) {
  return path?.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : "/app/upload";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = safeNextPath(url.searchParams.get("next"));
  let appBaseUrl: URL;
  try { appBaseUrl = getAppBaseUrl(); }
  catch { return NextResponse.json({ error: "Account confirmation is not configured." }, { status: 503 }); }
  if (!code) return NextResponse.redirect(new URL("/login?error=confirmation", appBaseUrl));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=confirmation", appBaseUrl));
  return NextResponse.redirect(new URL(nextPath, appBaseUrl));
}
