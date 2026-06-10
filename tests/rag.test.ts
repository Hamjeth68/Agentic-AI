import { describe, expect, it, beforeAll } from "vitest";
import { LocalVectorStore } from "../src/rag/vectorStore.js";
import { validateWithRag } from "../src/rag/validator.js";
import { extractContract } from "../src/services/extractor.js";
import { env } from "../src/config/env.js";

describe("RAG validation", () => {
  const store = new LocalVectorStore();

  beforeAll(async () => {
    await store.load(env.POLICY_DIR);
  });

  it("validates approved counterparties and required clauses", async () => {
    const extraction = await extractContract(`
Document Type: Service Agreement
Company: Flat Rock Technology Ltd
Counterparty: Acme Corp
Effective Date: 2026-07-01
Expiry Date: 2027-06-30
Governing Law: England and Wales
Termination Notice Days: 45
Liability Cap: Fees paid in the previous 12 months
Confidentiality Clause: Present
Data Protection Clause: Present
Company Signature: Signed
Counterparty Signature: Signed
`);
    const validation = await validateWithRag(extraction, store);
    expect(validation.counterpartyApproved).toBe(true);
    expect(validation.requiredClausesPresent).toBe(true);
    expect(validation.citations.length).toBeGreaterThan(0);
  });

  it("flags unapproved counterparties", async () => {
    const extraction = await extractContract(`
Document Type: Service Agreement
Company: Flat Rock Technology Ltd
Counterparty: Shadow Ventures
Effective Date: 2026-09-01
Expiry Date: 2027-09-01
Governing Law: Mars Colony
Termination Notice Days: 10
Liability Cap: Unlimited liability
Confidentiality Clause: Present
Data Protection Clause: Missing
Company Signature: Signed
Counterparty Signature: Signed
`);
    const validation = await validateWithRag(extraction, store);
    expect(validation.counterpartyApproved).toBe(false);
    expect(validation.findings.some((risk) => risk.riskType === "unapproved_counterparty")).toBe(true);
  });
});
