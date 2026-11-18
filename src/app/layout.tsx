import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { GlobalHeader } from "@/components/layout/GlobalHeader";

/* ─── Fonts ─────────────────────────────────────────────────────────────── */
// Inter: variable font — used for all UI controls, labels, body copy
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Newsreader: editorial serif — used for contract text and hero headlines
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

/* ─── Metadata ───────────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: "ScopeShield | Commercial Deal Analyzer",
  description:
    "Extract and redact PDF text in your browser. Optional AI analysis uses only reviewed redacted text you choose to send.",
  keywords: [
    "contract analysis",
    "MSA review",
    "SOW analysis",
    "freelancer tools",
    "IP protection",
    "scope creep",
  ],
};

/* ─── Root Layout ────────────────────────────────────────────────────────── */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-alabaster text-ink">
        <GlobalHeader />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
