import { describe, expect, it } from "vitest";
import { extractContract } from "../src/services/extractor.js";

describe("contract extraction", () => {
  it("extracts strict structured JSON with confidence and evidence", async () => {
    const extraction = await extractContract(`
Document Type: Service Agreement
Company: Flat Rock Technology Ltd
Counterparty: Acme Corp
Counterparty Address: 10 Market Street
Effective Date: 2026-07-01
Expiry Date: 2027-06-30
Governing Law: England and Wales
Payment Terms: Net 30
Termination Notice Days: 45
Liability Cap: Fees paid in the previous 12 months
Confidentiality Clause: Present
Data Protection Clause: Present
Company Signature: Signed
Counterparty Signature: Signed
`);
    expect(extraction.documentType).toBe("service_agreement");
    expect(extraction.missingFields).toEqual([]);
    expect(extraction.confidence.overall).toBeGreaterThanOrEqual(0.85);
    expect(extraction.evidence.counterpartyName).toContain("Acme Corp");
  });

  it("flags missing fields and low confidence", async () => {
    const extraction = await extractContract(`
Document Type: Vendor Agreement
Company: Flat Rock Technology Ltd
Counterparty: Northwind Traders
Effective Date: 2026-08-15
Governing Law: New York
Termination Notice Days: 15
Confidentiality Clause: Present
Data Protection Clause: Present
Company Signature: Signed
Counterparty Signature: Missing
`);
    expect(extraction.missingFields).toContain("contractDetails.expiryDate");
    expect(extraction.confidence.overall).toBeLessThan(0.85);
    expect(extraction.risks.some((risk) => risk.riskType === "signature_gap")).toBe(true);
  });
});
