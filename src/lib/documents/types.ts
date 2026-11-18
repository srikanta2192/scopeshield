import type { AnalysisResult } from "../analysis/types";

export type DocumentPage = {
  pageNumber: number;
  text: string;
  source: "embedded-text" | "ocr";
  ocrConfidence?: number;
};

export type ParsedDocument = {
  name: string;
  pages: DocumentPage[];
  updatedAt: number;
};

export type Redaction = { value: string; replacement: string; kind?: string };

export type DocumentSession = {
  id: "current";
  document: ParsedDocument;
  redactions: Redaction[];
  pdf: Blob;
  analysis?: AnalysisResult;
  updatedAt: number;
};

export type Progress = (message: string) => void;
