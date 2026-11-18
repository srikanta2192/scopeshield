---
name: scopeshield-architect
description: Product blueprint, privacy-first technical architecture, 7 agency contract trap rules, and calm editorial UI/UX design guidelines for ScopeShield.
---
# ScopeShield Architect

Guide the design, engineering, and product development of ScopeShield, a commercial deal and scope analyzer for freelance software developers, indie hackers, and boutique agencies reviewing client MSAs and SOWs.

## Summary

Provide architectural consistency, UI/UX design enforcement, and prompt engineering standards for ScopeShield. This blueprint incorporates the complete end-to-end flow, offline redaction sandbox, and progressive disclosure UI, and is optimized for direct handoff to Antigravity for full-stack implementation.

## Core Product Positioning

Position ScopeShield strictly as a **Commercial Deal & Scope Analyzer** for tech builders, not a generic legal advisor.

-   **Browser-first PDF workflow:** Handle locked client PDFs natively in the browser.
-   **NDA-Safe by Design (Offline First):** A mandatory manual redaction sandbox ensures sensitive data never leaves the browser.
-   **Actionable social fix:** Always pair clause redlines with a copy-ready **Polite Pushback Email** controlled by a Deal Leverage slider.
-   **Freelancer-friendly pricing:** Favor credit packs over high monthly recurring subscriptions.

## The "Big 7" Software & Agency Traps

Focus contract analysis and prompt schemas strictly on these seven commercial traps:

1.  **Background IP Theft**
2.  **Payment-on-Acceptance Trap**
3.  **Scope Creep & Infinite Revisions**
4.  **Net-60/90 + Early IP Transfer**
5.  **Uncapped Liability & Indemnification**
6.  **Trojan-Horse Non-Compete**
7.  **Missing Kill Fee (Termination for Convenience)**

## Technical Architecture & E2E Flow (The 5-Step Pipeline)

Follow this stateless, privacy-first pipeline when building ScopeShield:

1.  **Authentication & Global Navigation:** Enforce standard login/signup checks before allowing document uploads. Global layout must include Home, Pricing, Contact, and App views.
2.  **Layer 1 - Landing Dropzone:** A clear, distraction-free upload interface that explicitly states documents are processed offline first.
3.  **Layer 2 - Airplane Mode (Offline Redaction Sandbox):**
    *   **Fully Offline:** The browser parses the PDF locally. The user must manually scrub sensitive data (Client names, amounts, project codes) via the UI before the "Analyze Document" button activates.
    *   **Visuals:** Selected text is replaced with black pills and generic tags (e.g., `[Entity_1]`, `[Amount_A]`).
    *   **Local Ledger:** Tracks the real value mappings strictly in browser RAM.
4.  **Layer 3 - Document Viewer & Stateless LLM Pipeline:**
    *   The backend API receives only the redacted text (`[Entity_1]`).
    *   **Pass 1 (Definitions Graph):** Extract capitalized terms.
    *   **Pass 2 (7-Trap Scanner):** Request analysis and pre-fetch all three rewrite tiers (`soft`, `balanced`, `strict`) simultaneously to ensure instant UI updates when moving the Deal Leverage slider.
    *   **Zero-DB:** Do not store text on the backend. No complex BYOK or cache management settings are exposed to the user.
5.  **Layer 4 - Negotiation Mode & Re-hydration:**
    *   Compiles accepted drafts into a polite email.
    *   **Unredaction:** A toggle allows users to unmask the redacted data, seamlessly swapping the `[Entity_1]` tags back to real values locally before exporting.

## UI/UX Guidelines: "Calm Authority" Editorial Design

Avoid cluttered developer dashboards or alarmist red boxes.

-   **Palette & Typography:** `#F8F7F4` (warm alabaster) app background, crisp ivory document pages. Editorial serif font (*Newsreader* or *Georgia*) for contract clauses, clean sans-serif *Inter* for UI controls.
-   **Soft Highlighter Washes:** Pastel highlighter washes (soft terracotta for Critical, warm amber for Warning, sage green for Resolved).
-   **2-Column Progressive Disclosure:**
    -   **Left Pane:** Interactive PDF canvas or Offline Redaction canvas.
    -   **Right Pane:** Clean 2-Step Tab Switcher (`Document Viewer` and `Negotiation Mode`). Only **one active clause card** is expanded at a time to prevent cognitive overload.
    -   **Inline Controls:** The Deal Leverage selector and Accept/Flag decisions sit directly inside the active card.
-   **Settings & Export:** Focused entirely on copying the finalized text or downloading a PDF negotiation summary sheet.