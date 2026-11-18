import { NextResponse } from "next/server";
import { getCreditBalance } from "@/lib/billing/credits";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

function json(data: unknown, status: number) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  let user;
  try { user = await getAuthenticatedUser(); }
  catch { return json({ error: "Account services are not available." }, 503); }
  if (!user) return json({ error: "Sign in to view your balance." }, 401);
  try {
    const balance = await getCreditBalance(user.id);
    return json({ balance }, 200);
  } catch {
    return json({ error: "Could not load the credit balance." }, 503);
  }
}
