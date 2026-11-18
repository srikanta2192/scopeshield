"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/app-url";

export type AuthFormState = { error?: string; message?: string };

export async function authenticateAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const mode = formData.get("mode");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(String(formData.get("next") ?? "/app/upload"));
  if (!email || !email.includes("@") || password.length < 8) {
    return { error: "Enter a valid email and a password with at least 8 characters." };
  }

  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Sign-in is temporarily unavailable. Supabase is not configured." }; }

  if (mode === "signup") {
    let callback: URL;
    try { callback = new URL("/auth/callback", getAppBaseUrl()); }
    catch { return { error: "Account creation is not configured for this deployment." }; }
    
    callback.searchParams.set("next", nextPath);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: callback.toString() },
    });
    if (error) return { error: "Could not create your account. Check the email address and try again." };
    if (!data.session) return { message: "Check your email to confirm your account, then sign in." };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Email or password is incorrect." };
  }

  redirect(nextPath);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

function safeNextPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : "/app/upload";
}
