import { ContractExtraction, ContractExtractionSchema } from "../domain/schemas.js";
import { snippet } from "../utils/text.js";

const REQUIRED_FIELDS = [
  "parties.companyName",
  "parties.counterpartyName",
  "contractDetails.effectiveDate",
  "contractDetails.expiryDate",
  "contractDetails.governingLaw",
  "contractDetails.terminationNoticeDays",
  "contractDetails.liabilityCap"
];

function capture(text: string, label: string): string | undefined {
  const regex = new RegExp(`${label}:\\s*([^\\n]+)`, "i");
  return text.match(regex)?.[1]?.trim();
}

function captureNumber(text: string, label: string): number | undefined {
  const value = capture(text, label);
  const match = value?.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function documentType(text: string): ContractExtraction["documentType"] {
  const lower = text.toLowerCase();
  if (lower.includes("non-disclosure agreement") || lower.includes("nda")) return "nda";
  if (lower.includes("employment contract")) return "employment_contract";
  if (lower.includes("vendor agreement")) return "vendor_agreement";
  if (lower.includes("service agreement")) return "service_agreement";
  return "unknown";
}

function signatureStatus(text: string): ContractExtraction["contractDetails"]["signatureStatus"] {
  const companySigned = /company signature:\s*(signed|\/s\/|yes)/i.test(text);
  const counterpartySigned = /counterparty signature:\s*(signed|\/s\/|yes)/i.test(text);
  if (companySigned && counterpartySigned) return "signed";
  if (companySigned || counterpartySigned) return "partially_signed";
  if (/signature:\s*(missing|unsigned|no)/i.test(text)) return "unsigned";
  return "unknown";
}

export async function extractContract(text: string): Promise<ContractExtraction> {
  const confidentialityClausePresent = /confidentiality clause:\s*(present|yes)/i.test(text) || /confidential information/i.test(text);
  const dataProtectionClausePresent = /data protection clause:\s*(present|yes)/i.test(text) || /personal data|gdpr|data protection/i.test(text);
  const terminationNoticeDays = captureNumber(text, "Termination Notice Days");
  const liabilityCap = capture(text, "Liability Cap");
  const governingLaw = capture(text, "Governing Law");
  const counterpartyName = capture(text, "Counterparty");

  const extraction: ContractExtraction = {
    documentType: documentType(text),
    parties: {
      companyName: capture(text, "Company"),
      counterpartyName,
      counterpartyAddress: capture(text, "Counterparty Address")
    },
    contractDetails: {
      effectiveDate: capture(text, "Effective Date"),
      expiryDate: capture(text, "Expiry Date"),
      renewalTerms: capture(text, "Renewal Terms"),
      governingLaw,
      paymentTerms: capture(text, "Payment Terms"),
      terminationNoticeDays,
      liabilityCap,
      confidentialityClausePresent,
      dataProtectionClausePresent,
      signatureStatus: signatureStatus(text)
    },
    risks: [],
    missingFields: [],
    confidence: {
      overall: 0,
      fieldConfidence: {}
    },
    evidence: {}
  };

  for (const field of REQUIRED_FIELDS) {
    const value = field.split(".").reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], extraction);
    if (value === undefined || value === "") extraction.missingFields.push(field);
    extraction.confidence.fieldConfidence[field] = value === undefined || value === "" ? 0.25 : 0.93;
  }

  extraction.confidence.fieldConfidence["contractDetails.confidentialityClausePresent"] = confidentialityClausePresent ? 0.95 : 0.45;
  extraction.confidence.fieldConfidence["contractDetails.dataProtectionClausePresent"] = dataProtectionClausePresent ? 0.95 : 0.45;
  extraction.confidence.fieldConfidence["contractDetails.signatureStatus"] = extraction.contractDetails.signatureStatus === "signed" ? 0.95 : 0.55;

  if (!confidentialityClausePresent) {
    extraction.risks.push({
      riskType: "missing_confidentiality",
      severity: "high",
      description: "Required confidentiality clause is absent or not clearly detected.",
      evidence: snippet(text, /confidential/i, "No confidentiality evidence found.")
    });
  }
  if (extraction.contractDetails.signatureStatus !== "signed") {
    extraction.risks.push({
      riskType: "signature_gap",
      severity: "high",
      description: "Contract is not fully signed.",
      evidence: snippet(text, /signature/i, "No complete signature block found.")
    });
  }
  if (/unlimited liability|no liability cap/i.test(text)) {
    extraction.risks.push({
      riskType: "unlimited_liability",
      severity: "high",
      description: "Contract appears to include unlimited or uncapped liability.",
      evidence: snippet(text, /unlimited liability|no liability cap/i)
    });
  }

  extraction.evidence = {
    counterpartyName: snippet(text, /Counterparty:\s*[^\n]+/i),
    effectiveDate: snippet(text, /Effective Date:\s*[^\n]+/i),
    expiryDate: snippet(text, /Expiry Date:\s*[^\n]+/i),
    governingLaw: snippet(text, /Governing Law:\s*[^\n]+/i),
    liabilityCap: snippet(text, /Liability Cap:\s*[^\n]+/i),
    signatures: snippet(text, /signature/i)
  };

  const knownFields = REQUIRED_FIELDS.length - extraction.missingFields.length;
  const riskPenalty = extraction.risks.some((risk: { severity: string; }) => risk.severity === "high") ? 0.15 : 0;
  const signaturePenalty = extraction.contractDetails.signatureStatus === "signed" ? 0 : 0.12;
  extraction.confidence.overall = Math.max(0.1, Math.min(0.98, knownFields / REQUIRED_FIELDS.length - riskPenalty - signaturePenalty));

  return ContractExtractionSchema.parse(extraction);
}
