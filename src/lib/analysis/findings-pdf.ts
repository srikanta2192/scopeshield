import { PDFDocument, StandardFonts } from "pdf-lib";
import { wrapText } from "../documents/redacted-pdf";
import { TRAPS, type AnalysisResult } from "./types";

const W = 612, H = 792, MARGIN = 48;

/** Text-only report built from the redacted findings; it never touches the uploaded PDF. */
export async function createFindingsPdf(result: AnalysisResult): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle("ScopeShield Findings"); pdf.setCreator("ScopeShield");
  const safe = (s: string) => [...s].map((c) => { try { font.encodeText(c); return c; } catch { return "?"; } }).join("");
  let page = pdf.addPage([W, H]);
  let y = H - MARGIN;
  const write = (text: string, f = font, size = 10, indent = 0) => {
    for (const line of wrapText(safe(text), f, size, W - MARGIN * 2 - indent)) {
      if (y < MARGIN) { page = pdf.addPage([W, H]); y = H - MARGIN; }
      page.drawText(line, { x: MARGIN + indent, y, size, font: f }); y -= size + 4;
    }
  };
  write("ScopeShield findings (redacted text)", bold, 14);
  write("Commercial analysis, not legal advice.");
  y -= 10;
  for (const f of result.findings) {
    write(`${f.severity === "critical" ? "CRITICAL" : "WARNING"} - ${TRAPS[f.trap]}${f.resolved ? " (resolved)" : ""}`, bold, 11);
    write(`"${f.quote}"`, font, 10, 12);
    write(`Impact: ${f.impact}`, font, 10, 12);
    write(`Suggestion: ${f.suggestion}`, font, 10, 12);
    y -= 10;
  }
  if (result.notFound.length) write(`Not found: ${result.notFound.map((t) => TRAPS[t]).join("; ")}`);
  return pdf.save({ useObjectStreams: false });
}
