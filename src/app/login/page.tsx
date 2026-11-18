import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Login | ScopeShield" };

export default function LoginPage(props: { searchParams: Promise<{ next?: string; error?: string }> }) {
  return <Suspense fallback={<div className="flex flex-1 items-center justify-center p-10 text-sm text-ink-light">Loading sign-in…</div>}>
    <LoginPageContent searchParams={props.searchParams} />
  </Suspense>;
}

async function LoginPageContent({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const requestedPath = params.next ?? "/app/upload";
  const initialError = params.error === "confirmation" ? "That confirmation link could not be verified. Request a new account confirmation and try again." : "";
  const nextPath = requestedPath.startsWith("/") && !requestedPath.startsWith("//") && !requestedPath.includes("\\")
    ? requestedPath : "/app/upload";

  return <div className="flex flex-1 items-center justify-center px-6 py-16">
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-4 flex justify-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-terracotta"><ShieldCheck className="h-6 w-6 text-terracotta-dark" /></span></div>
      <h1 className="mb-2 text-center font-serif text-3xl text-ink">Welcome to ScopeShield</h1>
      <p className="mb-6 text-center text-sm text-ink-light">Sign in to use AI analysis credits. Your PDFs stay on this device.</p>
      <AuthForm nextPath={nextPath} initialError={initialError} />
      <p className="mt-6 text-center text-xs text-gray-500">Local PDF redaction is free. Your account stores identity and credit balance only.</p>
      <p className="mt-4 text-center text-sm"><Link href="/pricing" className="text-terracotta-dark underline">View credit packs</Link></p>
    </div>
  </div>;
}
