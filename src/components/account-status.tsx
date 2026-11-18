"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOutAction } from "@/app/login/actions";

export function AccountStatus() {
  const [balance, setBalance] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/billing/credits", { cache: "no-store" }).then(async (response) => {
      if (!active) return;
      if (response.status === 401) { setSignedIn(false); return; }
      if (!response.ok) return;
      const result = await response.json() as { balance: number };
      if (active) { setSignedIn(true); setBalance(result.balance); }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (signedIn === false) return <Link href="/login?next=%2Fapp%2Fupload" className="rounded-lg border px-4 py-2 text-sm">Sign in for AI analysis</Link>;
  if (signedIn !== true) return null;
  return <div className="flex items-center gap-3 text-sm">
    <span>{balance ?? "…"} analysis credits</span>
    <Link href="/pricing" className="underline">Buy credits</Link>
    <form action={signOutAction}><button className="underline">Sign out</button></form>
  </div>;
}
