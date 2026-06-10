import { mkdir, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { EmailWebhookPayload } from "../domain/schemas.js";
import { JsonStore } from "../db/jsonStore.js";
import { parsePdf } from "./pdf.js";
import { extractContract } from "./extractor.js";
import { validateWithRag } from "../rag/validator.js";
import { LocalVectorStore } from "../rag/vectorStore.js";
import { decideRoute } from "./router.js";

export interface IncomingAttachment {
  originalName: string;
  mimeType: string;
  path: string;
  sizeBytes?: number;
}

export class ContractProcessor {
  constructor(
    private readonly store: JsonStore,
    private readonly vectorStore: LocalVectorStore
  ) {}

  async process(email: EmailWebhookPayload, attachment: IncomingAttachment) {
    if (attachment.mimeType !== "application/pdf" && !attachment.originalName.toLowerCase().endsWith(".pdf")) {
      throw new Error("Only PDF attachments are supported");
    }

    await mkdir(env.ATTACHMENT_DIR, { recursive: true });
    const storedPath = path.join(env.ATTACHMENT_DIR, `${Date.now()}-${attachment.originalName}`);
    await copyFile(attachment.path, storedPath);

    const parsed = await parsePdf(storedPath);
    const extraction = await extractContract(parsed.text);
    const validation = await validateWithRag(extraction, this.vectorStore);
    const route = decideRoute(extraction, validation);
    const sizeBytes = attachment.sizeBytes ?? (await stat(storedPath)).size;

    const ids = await this.store.saveProcessingResult({
      email: {
        from: email.from,
        to: email.to,
        subject: email.subject,
        messageId: email.messageId,
        receivedAt: email.receivedAt ?? new Date().toISOString(),
        textBody: email.textBody
      },
      attachment: {
        fileName: attachment.originalName,
        mimeType: attachment.mimeType,
        storagePath: storedPath,
        sizeBytes
      },
      extraction,
      validation,
      route
    });

    return { ...ids, extraction, validation, route, parsed };
  }
}
