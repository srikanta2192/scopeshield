"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CreditPackId } from "@/lib/billing/catalog";

export function CheckoutButton({ pack, next, children }: { pack: CreditPackId; next: string; children: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function beginCheckout() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const result = await response.json() as { url?: string; error?: string };
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!response.ok || !result.url) throw new Error(result.error ?? "Checkout is unavailable.");
      window.location.assign(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout is unavailable.");
      setPending(false);
    }
  }

  return <div>
    <button type="button" onClick={() => void beginCheckout()} disabled={pending} className="w-full rounded-lg bg-terracotta-dark py-3 text-center text-sm font-medium text-white transition-colors hover:bg-[#B36350] disabled:opacity-50">{pending ? "Opening checkout…" : children}</button>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
