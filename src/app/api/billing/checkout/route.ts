import { NextResponse } from "next/server";
import { createCreditCheckoutSession } from "@/lib/billing/checkout";
import { parseCreditPack } from "@/lib/billing/catalog";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

function json(data: unknown, status: number) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let user;
  try { user = await getAuthenticatedUser(); }
  catch { return json({ error: "Account services are not available." }, 503); }
  if (!user) return json({ error: "Sign in before buying credits." }, 401);

  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ error: "Choose a valid credit pack." }, 400); }
  const pack = typeof body === "object" && body !== null && "pack" in body
    ? parseCreditPack((body as { pack: unknown }).pack) : null;
  if (!pack) return json({ error: "Choose a valid credit pack." }, 400);

  try {
    const url = await createCreditCheckoutSession({ id: user.id, email: user.email }, pack);
    return json({ url }, 200);
  } catch {
    return json({ error: "Checkout is not available right now." }, 503);
  }
}
