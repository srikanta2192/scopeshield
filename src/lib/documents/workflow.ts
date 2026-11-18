import { applyRedactions, restoreRedactionSuggestions, suggestRedactions, type RedactionSuggestion } from "./auto-redact";
import { loadLocalSession, saveLocalSession, clearLocalSession } from "./session-store";
import type { AnalysisResult } from "../analysis/types";
import { parsePdf } from "./parse-pdf";
import type { DocumentPage, DocumentSession, ParsedDocument, Progress, Redaction } from "./types";

export const MAX_PDF_SIZE = 25 * 1024 * 1024;

export type PreparedDocument = {
  document: ParsedDocument;
  pdf: Blob;
  suggestions: RedactionSuggestion[];
  redactions: Redaction[];
};

export type WorkspaceSnapshot = {
  document: ParsedDocument | null;
  pdf: Blob | null;
  redactions: Redaction[];
  analysis?: AnalysisResult;
};

export type DocumentSessionStore = Pick<typeof import("./session-store"), "loadLocalSession" | "saveLocalSession" | "clearLocalSession">;

/** Coordinates browser-only document work and opt-in local persistence without depending on a UI framework. */
export function createDocumentWorkflow(sessionStore: DocumentSessionStore = {
  loadLocalSession, saveLocalSession, clearLocalSession,
}) {
  return {
    async prepare(file: File, onProgress?: Progress, signal?: AbortSignal): Promise<PreparedDocument> {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("Choose a PDF document.");
      }
      if (file.size > MAX_PDF_SIZE) throw new Error("Choose a PDF smaller than 25 MB for this initial version.");
      const parsed = await parsePdf(file, onProgress, signal);
      const document: ParsedDocument = { name: file.name, pages: parsed.pages, updatedAt: Date.now() };
      const suggestions = await suggestRedactions(parsed.pages);
      return {
        document,
        pdf: file,
        suggestions,
        redactions: suggestions.map(({ value, replacement, kind }) => ({ value, replacement, kind })),
      };
    },

    async restore(remember: boolean): Promise<(DocumentSession & { suggestions: RedactionSuggestion[] }) | null> {
      if (!remember) return null;
      const session = await sessionStore.loadLocalSession();
      return session ? {
        ...session,
        suggestions: restoreRedactionSuggestions(session.document.pages, session.redactions),
      } : null;
    },

    async persist(remember: boolean, snapshot: WorkspaceSnapshot): Promise<void> {
      if (!remember || !snapshot.document || !snapshot.pdf) return;
      await sessionStore.saveLocalSession({
        document: snapshot.document,
        redactions: snapshot.redactions,
        pdf: snapshot.pdf,
        analysis: snapshot.analysis,
      });
    },

    clear(): Promise<void> {
      return sessionStore.clearLocalSession();
    },

    redactedText(document: ParsedDocument | null, redactions: Redaction[]): string {
      return document?.pages.map((page: DocumentPage) => applyRedactions(page.text, redactions)).join("\n\n") ?? "";
    },
  };
}

export const documentWorkflow = createDocumentWorkflow();
