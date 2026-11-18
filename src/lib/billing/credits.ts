import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CreditReservation = "reserved" | "no_credits" | "rate_limited" | "duplicate_request";

export async function reserveAnalysisCredit(userId: string, requestId: string): Promise<CreditReservation> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("reserve_analysis_credit", {
    p_user_id: userId,
    p_request_id: requestId,
  });
  if (error) throw new Error("Could not reserve an analysis credit.");
  if (data === "reserved" || data === "no_credits" || data === "rate_limited" || data === "duplicate_request") return data;
  throw new Error("The credit service returned an unexpected reservation status.");
}

export async function refundAnalysisCredit(userId: string, requestId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("refund_analysis_credit", {
    p_user_id: userId,
    p_request_id: requestId,
  });
  if (error || data !== true) throw new Error("Could not return the unused analysis credit.");
}

export async function grantPurchasedCredits(input: {
  userId: string;
  credits: number;
  checkoutSessionId: string;
  stripeEventId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("grant_purchased_credits", {
    p_user_id: input.userId,
    p_credits: input.credits,
    p_checkout_session_id: input.checkoutSessionId,
    p_stripe_event_id: input.stripeEventId,
  });
  if (error) throw new Error("Could not apply the verified credit purchase.");
  return data === true;
}

export async function getCreditBalance(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("credit_accounts").select("balance").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Could not load the credit balance.");
  return data?.balance ?? 0;
}
