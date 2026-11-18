"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
] as const;

/**
 * Global sticky header — present on every page.
 * Shows the ScopeShield logo, nav links, and primary CTA.
 * Collapses to a hamburger menu on mobile.
 */
export function GlobalHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-alabaster/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-ink hover:opacity-80 transition-opacity"
          aria-label="ScopeShield home"
        >
          <ShieldCheck
            className="h-6 w-6 text-terracotta-dark"
            strokeWidth={2}
          />
          <span className="text-xl font-semibold tracking-tight">
            ScopeShield
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-ink-light">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`transition-colors hover:text-ink ${
                pathname === href ? "text-ink" : ""
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-ink-light hover:text-ink transition-colors"
          >
            Login
          </Link>
          <Link
            href="/app/upload"
            className="rounded-md bg-terracotta-dark px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#B36350] transition-colors"
          >
            Start Shielding
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden rounded-md p-2 text-ink-light hover:bg-gray-100 transition-colors"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-alabaster px-6 pb-6 pt-4">
          <nav className="flex flex-col gap-4">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`text-sm font-medium transition-colors hover:text-ink ${
                  pathname === href ? "text-ink" : "text-ink-light"
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-3 border-t border-gray-200 pt-4">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-ink-light hover:text-ink transition-colors"
              >
                Login / Sign Up
              </Link>
              <Link
                href="/app/upload"
                onClick={() => setMobileOpen(false)}
                className="rounded-md bg-terracotta-dark px-4 py-2 text-center text-sm font-medium text-white hover:bg-[#B36350] transition-colors"
              >
                Start Shielding
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
