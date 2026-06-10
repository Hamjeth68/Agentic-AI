declare module "pdfkit" {
  import { Writable } from "node:stream";

  export default class PDFDocument {
    constructor(options?: Record<string, unknown>);
    pipe(stream: Writable): void;
    fontSize(size: number): this;
    text(text: string, options?: Record<string, unknown>): this;
    moveDown(lines?: number): this;
    addPage(options?: Record<string, unknown>): this;
    end(): void;
  }
}
