import { describe, expect, it } from "vitest";
import { decideRoute } from "../src/services/router.js";
import { extractContract } from "../src/services/extractor.js";
import { validateWithRag } from "../src/rag/validator.js";
import { LocalVectorStore } from "../src/rag/vectorStore.js";
import { env } from "../src/config/env.js";

describe("routing logic", () => {
  it("auto-stores only when all gates pass", async () => {
    const store = new LocalVectorStore();
    await store.load(env.POLICY_DIR);
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
    expect(decideRoute(extraction, validation).route).toBe("auto-store");
  });
});
