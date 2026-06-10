import { describe, expect, it, beforeAll } from "vitest";
import path from "node:path";
import { stat } from "node:fs/promises";
import { ContractProcessor } from "../src/services/processor.js";
import { JsonStore } from "../src/db/jsonStore.js";
import { LocalVectorStore } from "../src/rag/vectorStore.js";
import { env } from "../src/config/env.js";

describe("email webhook processing integration", () => {
  let processor: ContractProcessor;

  beforeAll(async () => {
    const vectorStore = new LocalVectorStore();
    await vectorStore.load(env.POLICY_DIR);
    processor = new ContractProcessor(new JsonStore(env.DATA_DIR), vectorStore);
  });

  async function processSample(sample: string, messageId: string) {
    const filePath = path.resolve("samples", sample);
    const fileStat = await stat(filePath);
    return processor.process(
      {
        from: "contracts@example.com",
        to: "intake@flatrock.example",
        subject: `Contract intake: ${sample}`,
        messageId,
        receivedAt: new Date().toISOString()
      },
      {
        originalName: sample,
        mimeType: "application/pdf",
        path: filePath,
        sizeBytes: fileStat.size
      }
    );
  }

  it("processes a clean PDF attachment into auto-store", async () => {
    const result = await processSample("clean-service-agreement.pdf", "<clean@example.com>");

    expect(result.route.route).toBe("auto-store");
    expect(result.parsed.pageCount).toBe(2);
    expect(result.validation.counterpartyApproved).toBe(true);
  });

  it("routes messy missing-field PDFs to human review", async () => {
    const result = await processSample("missing-fields-vendor-agreement.pdf", "<missing@example.com>");

    expect(result.route.route).toBe("human-review");
    expect(result.reviewItemId).toBeTruthy();
    expect(result.extraction.missingFields).toContain("contractDetails.expiryDate");
  });

  it("routes risky unapproved contracts to human review", async () => {
    const result = await processSample("risky-unapproved-contract.pdf", "<risky@example.com>");

    expect(result.route.route).toBe("human-review");
    expect(result.reviewItemId).toBeTruthy();
    expect(result.validation.counterpartyApproved).toBe(false);
  });
});
