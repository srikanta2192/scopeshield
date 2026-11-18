import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { applyRedactions } from "./auto-redact";
import type { ParsedDocument, Redaction } from "./types";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const FONT_SIZE = 10;
const LINE_HEIGHT = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = 48;

/** Creates a new text-only document; it never reads or copies the uploaded PDF bytes. */
export async function createRedactedPdf(document: ParsedDocument, redactions: Redaction[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle("ScopeShield Redacted Copy");
  pdf.setAuthor("ScopeShield");
  pdf.setSubject("Redacted document text");
  pdf.setCreator("ScopeShield");

  let outputPage = 0;
  const beginPage = (continuation: boolean): { page: PDFPage; cursorY: number } => {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    outputPage += 1;
    page.drawText("ScopeShield · Redacted text copy", {
      x: MARGIN, y: PAGE_HEIGHT - 42, size: 9, font: boldFont, color: rgb(0.24, 0.28, 0.25),
    });
    if (continuation) page.drawText("Continued", {
      x: MARGIN, y: PAGE_HEIGHT - 62, size: 9, font, color: rgb(0.4, 0.4, 0.4),
    });
    page.drawText(`Page ${outputPage}`, {
      x: PAGE_WIDTH - MARGIN - 50, y: 24, size: 8, font, color: rgb(0.4, 0.4, 0.4),
    });
    return { page, cursorY: PAGE_HEIGHT - (continuation ? 82 : 66) };
  };
  let { page, cursorY } = beginPage(false);

  for (const [index, sourcePage] of document.pages.entries()) {
    if (cursorY - LINE_HEIGHT < CONTENT_BOTTOM) ({ page, cursorY } = beginPage(true));
    page.drawText(`Document page ${sourcePage.pageNumber || index + 1}`, {
      x: MARGIN, y: cursorY, size: 11, font: boldFont, color: rgb(0.12, 0.14, 0.13),
    });
    cursorY -= LINE_HEIGHT * 1.7;
    const redactedText = applyRedactions(sourcePage.text, redactions);
    for (const line of wrapText(redactedText, font, FONT_SIZE, CONTENT_WIDTH)) {
      if (cursorY - LINE_HEIGHT < CONTENT_BOTTOM) ({ page, cursorY } = beginPage(true));
      page.drawText(line, {
        x: MARGIN, y: cursorY, size: FONT_SIZE, font, color: rgb(0.12, 0.14, 0.13),
      });
      cursorY -= LINE_HEIGHT;
    }
    cursorY -= LINE_HEIGHT;
  }

  return pdf.save({ useObjectStreams: false });
}

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (!paragraph) { lines.push(""); continue; }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const chunks = splitLongWord(word, font, size, maxWidth);
      for (const chunk of chunks) {
        const candidate = current ? `${current} ${chunk}` : chunk;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
        else { if (current) lines.push(current); current = chunk; }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  try { font.encodeText(word); }
  catch { throw new Error("This PDF contains characters the export font cannot represent. Copy the reviewed text instead."); }
  if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
  const chunks: string[] = [];
  let current = "";
  for (const character of word) {
    const candidate = current + character;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      chunks.push(current);
      current = character;
    } else current = candidate;
  }
  if (current) chunks.push(current);
  return chunks;
}
