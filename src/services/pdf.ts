import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import { normalizeText } from "../utils/text.js";

export interface ParsedPdf {
  text: string;
  pageCount: number;
  parser: "pdf-parse";
}

export async function parsePdf(filePath: string): Promise<ParsedPdf> {
  const data = await readFile(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const text = normalizeText(result.text ?? "");
    if (text.length < 40) {
      throw new Error("PDF text extraction produced too little text for reliable review");
    }
    return {
      text,
      pageCount: result.pages.length,
      parser: "pdf-parse"
    };
  } finally {
    await parser.destroy();
  }
}
