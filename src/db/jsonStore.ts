import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ContractExtraction, RagValidation, RouteDecision } from "../domain/schemas.js";

export interface EmailRecord {
  id: string;
  from: string;
  to: string;
  subject: string;
  messageId: string;
  receivedAt: string;
  textBody?: string;
}

export interface AttachmentRecord {
  id: string;
  emailId: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  sizeBytes: number;
  status: "received" | "processed" | "failed";
}

export interface ContractRecord {
  id: string;
  emailId: string;
  attachmentId: string;
  extraction: ContractExtraction;
  route: RouteDecision;
  createdAt: string;
}

export interface ReviewItem {
  id: string;
  contractId: string;
  status: "pending" | "approved" | "rejected";
  recommendedAction: string;
  reasons: string[];
  createdAt: string;
  resolvedAt?: string;
}

export interface AuditLog {
  id: string;
  entityId: string;
  step: string;
  message: string;
  createdAt: string;
}

export interface DatabaseShape {
  emails: EmailRecord[];
  attachments: AttachmentRecord[];
  contract_extractions: ContractRecord[];
  rag_validation_results: Array<{ id: string; contractId: string; validation: RagValidation; createdAt: string }>;
  human_review_items: ReviewItem[];
  audit_logs: AuditLog[];
}

const emptyDb = (): DatabaseShape => ({
  emails: [],
  attachments: [],
  contract_extractions: [],
  rag_validation_results: [],
  human_review_items: [],
  audit_logs: []
});

export class JsonStore {
  private filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "db", "database.json");
  }

  async reset(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(emptyDb(), null, 2));
  }

  async read(): Promise<DatabaseShape> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as DatabaseShape;
    } catch {
      const db = emptyDb();
      await this.write(db);
      return db;
    }
  }

  async write(db: DatabaseShape): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(db, null, 2));
  }

  async appendAudit(entityId: string, step: string, message: string): Promise<void> {
    const db = await this.read();
    db.audit_logs.push({ id: randomUUID(), entityId, step, message, createdAt: new Date().toISOString() });
    await this.write(db);
  }

  async saveProcessingResult(input: {
    email: Omit<EmailRecord, "id">;
    attachment: Omit<AttachmentRecord, "id" | "emailId" | "status">;
    extraction: ContractExtraction;
    validation: RagValidation;
    route: RouteDecision;
  }): Promise<{ emailId: string; attachmentId: string; contractId: string; reviewItemId?: string }> {
    const db = await this.read();
    const emailId = randomUUID();
    const attachmentId = randomUUID();
    const contractId = randomUUID();
    db.emails.push({ id: emailId, ...input.email });
    db.attachments.push({ id: attachmentId, emailId, ...input.attachment, status: "processed" });
    db.contract_extractions.push({
      id: contractId,
      emailId,
      attachmentId,
      extraction: input.extraction,
      route: input.route,
      createdAt: new Date().toISOString()
    });
    db.rag_validation_results.push({
      id: randomUUID(),
      contractId,
      validation: input.validation,
      createdAt: new Date().toISOString()
    });
    let reviewItemId: string | undefined;
    if (input.route.route === "human-review") {
      reviewItemId = randomUUID();
      db.human_review_items.push({
        id: reviewItemId,
        contractId,
        status: "pending",
        recommendedAction: input.route.recommendedAction,
        reasons: input.route.reasons,
        createdAt: new Date().toISOString()
      });
    }
    db.audit_logs.push(
      { id: randomUUID(), entityId: contractId, step: "receive_email", message: "Email metadata and attachment saved.", createdAt: new Date().toISOString() },
      { id: randomUUID(), entityId: contractId, step: "extract", message: "Structured extraction completed and schema validated.", createdAt: new Date().toISOString() },
      { id: randomUUID(), entityId: contractId, step: "rag_validate", message: "Policy retrieval and validation completed.", createdAt: new Date().toISOString() },
      { id: randomUUID(), entityId: contractId, step: "route", message: `Final deterministic route: ${input.route.route}.`, createdAt: new Date().toISOString() }
    );
    await this.write(db);
    return { emailId, attachmentId, contractId, reviewItemId };
  }

  async updateReview(id: string, status: "approved" | "rejected"): Promise<ReviewItem | undefined> {
    const db = await this.read();
    const item = db.human_review_items.find((review) => review.id === id);
    if (!item) return undefined;
    item.status = status;
    item.resolvedAt = new Date().toISOString();
    db.audit_logs.push({
      id: randomUUID(),
      entityId: item.contractId,
      step: `human_${status}`,
      message: `Reviewer marked item ${status}.`,
      createdAt: new Date().toISOString()
    });
    await this.write(db);
    return item;
  }
}
