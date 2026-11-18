import type { DocumentPage, Progress } from "./types";

type ParsedPdf = { pages: DocumentPage[] };

export async function parsePdf(
  file: Blob,
  onProgress: Progress = () => {},
  signal?: AbortSignal,
): Promise<ParsedPdf> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url,
  ).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let ocrWorker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | undefined;
  const abort = () => { void task.destroy(); void ocrWorker?.terminate(); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const pdf = await task.promise;
    const pages: DocumentPage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (signal?.aborted) throw new DOMException("Processing cancelled", "AbortError");
      onProgress(`Reading page ${pageNumber} of ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = content.items.map((item) => "str" in item
        ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
      let source: DocumentPage["source"] = "embedded-text";
      let ocrConfidence: number | undefined;
      if (text.length < 24) {
        source = "ocr";
        onProgress(`Scanning page ${pageNumber} of ${pdf.numPages} locally…`);
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error(`Could not prepare page ${pageNumber} for local OCR.`);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        ocrWorker ??= await (await import("tesseract.js")).createWorker("eng", 1);
        const result = await ocrWorker.recognize(canvas);
        text = result.data.text.trim();
        ocrConfidence = result.data.confidence;
        canvas.width = 0; canvas.height = 0;
        if (text.length < 10) throw new Error(`Page ${pageNumber} could not be read reliably. It remains on your device and was not sent.`);
      }
      if (source === "ocr" && (ocrConfidence ?? 0) < 45) {
        throw new Error(`Page ${pageNumber} could not be read reliably. Review or rescan it before continuing. It remains on your device and was not sent.`);
      }
      pages.push({ pageNumber, text, source, ocrConfidence });
      page.cleanup();
    }
    return { pages };
  } finally {
    signal?.removeEventListener("abort", abort);
    try { await ocrWorker?.terminate(); } catch { /* OCR worker may already be terminated after cancellation. */ }
    try { await task.destroy(); } catch { /* PDF task may already be destroyed after cancellation. */ }
  }
}
