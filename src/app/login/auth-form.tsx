"use client";

import { useActionState, useState } from "react";
import { authenticateAction, type AuthFormState } from "./actions";

export function AuthForm({ nextPath, initialError = "" }: { nextPath: string; initialError?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(authenticateAction, {});

  return <form action={formAction} className="space-y-4 text-left">
    <input type="hidden" name="mode" value={mode} />
    <input type="hidden" name="next" value={nextPath} />
    <div className="flex rounded-lg bg-gray-100 p-1 text-sm">
      <button type="button" onClick={() => setMode("signin")} aria-pressed={mode === "signin"} className={`flex-1 rounded-md py-2 ${mode === "signin" ? "bg-white font-semibold shadow-sm" : ""}`}>Sign in</button>
      <button type="button" onClick={() => setMode("signup")} aria-pressed={mode === "signup"} className={`flex-1 rounded-md py-2 ${mode === "signup" ? "bg-white font-semibold shadow-sm" : ""}`}>Create account</button>
    </div>
    <label className="block text-sm">Email address<input name="email" type="email" autoComplete="email" required className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3" /></label>
    <label className="block text-sm">Password<input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3" /></label>
    {(state.error || initialError) && <p role="alert" className="rounded-lg bg-amber p-3 text-sm">{state.error || initialError}</p>}
    {state.message && <p role="status" className="rounded-lg bg-sage p-3 text-sm">{state.message}</p>}
    <button disabled={pending} className="w-full rounded-lg bg-ink py-3 text-sm font-medium text-white disabled:opacity-50">{pending ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
  </form>;
}
