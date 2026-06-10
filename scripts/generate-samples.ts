import { mkdirSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";

const sampleDir = path.resolve(process.cwd(), "samples");
mkdirSync(sampleDir, { recursive: true });

const samples = [
  {
    file: "clean-service-agreement.pdf",
    title: "Service Agreement",
    lines: [
      "Document Type: Service Agreement",
      "Company: Flat Rock Technology Ltd",
      "Counterparty: Acme Corp",
      "Counterparty Address: 10 Market Street, London",
      "Effective Date: 2026-07-01",
      "Expiry Date: 2027-06-30",
      "Renewal Terms: Annual renewal by mutual written agreement.",
      "Governing Law: England and Wales",
      "Payment Terms: Net 30 days from invoice receipt.",
      "Termination Notice Days: 45",
      "Liability Cap: Fees paid in the previous 12 months",
      "Confidentiality Clause: Present. Each party must protect confidential information.",
      "Data Protection Clause: Present. Parties comply with GDPR and incident notification obligations.",
      "Company Signature: Signed",
      "Counterparty Signature: Signed"
    ]
  },
  {
    file: "missing-fields-vendor-agreement.pdf",
    title: "Vendor Agreement",
    lines: [
      "Document Type: Vendor Agreement",
      "Company: Flat Rock Technology Ltd",
      "Counterparty: Northwind Traders",
      "Counterparty Address: Not provided",
      "Effective Date: 2026-08-15",
      "Renewal Terms: Month to month.",
      "Governing Law: New York",
      "Payment Terms: Net 60 days.",
      "Termination Notice Days: 15",
      "Liability Cap: Fees paid in the previous 12 months",
      "Confidentiality Clause: Present. Confidential information must be protected.",
      "Data Protection Clause: Present. Vendor must protect personal data.",
      "Company Signature: Signed",
      "Counterparty Signature: Missing"
    ]
  },
  {
    file: "risky-unapproved-contract.pdf",
    title: "Service Agreement",
    lines: [
      "Document Type: Service Agreement",
      "Company: Flat Rock Technology Ltd",
      "Counterparty: Shadow Ventures",
      "Counterparty Address: 404 Unknown Avenue",
      "Effective Date: 2026-09-01",
      "Expiry Date: 2027-09-01",
      "Renewal Terms: Auto-renews unless cancelled.",
      "Governing Law: Mars Colony",
      "Payment Terms: Due on receipt.",
      "Termination Notice Days: 10",
      "Liability Cap: Unlimited liability with no liability cap",
      "Confidentiality Clause: Present. The parties protect confidential information.",
      "Data Protection Clause: Missing.",
      "Company Signature: Signed",
      "Counterparty Signature: Signed"
    ]
  }
];

async function writeSample(sample: (typeof samples)[number]) {
  const doc = new PDFDocument({ margin: 56 });
  const output = createWriteStream(path.join(sampleDir, sample.file));
  doc.pipe(output);
  doc.fontSize(18).text(sample.title, { underline: true });
  doc.moveDown();
  for (const line of sample.lines) {
    doc.fontSize(11).text(line);
  }
  doc.addPage();
  doc.fontSize(14).text("Additional Terms");
  doc.fontSize(11).text("This page confirms multi-page PDF parsing for the contract intake workflow.");
  doc.end();
  await new Promise<void>((resolve, reject) => {
    output.on("finish", resolve);
    output.on("error", reject);
  });
}

for (const sample of samples) {
  await writeSample(sample);
}

console.log(`Generated ${samples.length} sample PDFs in ${sampleDir}`);
