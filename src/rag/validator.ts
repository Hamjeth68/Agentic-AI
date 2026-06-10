import { ContractExtraction, RagValidation, RagValidationSchema } from "../domain/schemas.js";
import { LocalVectorStore } from "./vectorStore.js";

const APPROVED_COUNTERPARTIES = ["Acme Corp", "Northwind Traders", "Globex LLC", "Blue Harbor Analytics"];
const ALLOWED_LAWS = ["England and Wales", "New York", "California"];

function liabilityCapOk(value?: string): boolean {
  if (!value) return false;
  if (/unlimited|uncapped|no cap/i.test(value)) return false;
  return /fees paid|12 months|one year|\$|usd|eur|gbp/i.test(value);
}

export async function validateWithRag(extraction: ContractExtraction, store: LocalVectorStore): Promise<RagValidation> {
  const query = [
    extraction.parties.counterpartyName,
    extraction.documentType,
    extraction.contractDetails.governingLaw,
    extraction.contractDetails.liabilityCap,
    "approved vendor client required clauses termination liability data protection signature"
  ]
    .filter(Boolean)
    .join(" ");
  const retrieved = store.retrieve(query, 5);
  const counterpartyApproved = Boolean(
    extraction.parties.counterpartyName && APPROVED_COUNTERPARTIES.includes(extraction.parties.counterpartyName)
  );
  const requiredClausesPresent =
    extraction.contractDetails.confidentialityClausePresent && extraction.contractDetails.dataProtectionClausePresent;
  const terminationNoticeAcceptable = (extraction.contractDetails.terminationNoticeDays ?? -1) >= 30;
  const liabilityCapAcceptable = liabilityCapOk(extraction.contractDetails.liabilityCap);
  const governingLawAllowed = Boolean(
    extraction.contractDetails.governingLaw && ALLOWED_LAWS.includes(extraction.contractDetails.governingLaw)
  );
  const dataProtectionCompliant = extraction.contractDetails.dataProtectionClausePresent;
  const findings: RagValidation["findings"] = [];
  const reasoningTrace: string[] = [];

  reasoningTrace.push(`Retrieved ${retrieved.length} policy documents for validation.`);
  reasoningTrace.push(`Counterparty approved: ${counterpartyApproved}.`);
  reasoningTrace.push(`Required clauses present: ${requiredClausesPresent}.`);

  if (!counterpartyApproved) {
    findings.push({
      riskType: "unapproved_counterparty",
      severity: "high",
      description: "Counterparty is not present in the approved client/vendor list.",
      evidence: extraction.parties.counterpartyName ?? "Counterparty missing"
    });
  }
  if (!requiredClausesPresent) {
    findings.push({
      riskType: "missing_required_clause",
      severity: "high",
      description: "Required confidentiality and data protection clauses must both be present.",
      evidence: JSON.stringify({
        confidentiality: extraction.contractDetails.confidentialityClausePresent,
        dataProtection: extraction.contractDetails.dataProtectionClausePresent
      })
    });
  }
  if (!terminationNoticeAcceptable) {
    findings.push({
      riskType: "termination_notice_short",
      severity: "medium",
      description: "Termination notice is below the policy minimum of 30 days.",
      evidence: String(extraction.contractDetails.terminationNoticeDays ?? "missing")
    });
  }
  if (!liabilityCapAcceptable) {
    findings.push({
      riskType: "liability_cap_unacceptable",
      severity: "high",
      description: "Liability cap is missing, unlimited, or not expressed against approved references.",
      evidence: extraction.contractDetails.liabilityCap ?? "missing"
    });
  }
  if (!governingLawAllowed) {
    findings.push({
      riskType: "governing_law_not_allowed",
      severity: "high",
      description: "Governing law is not in the approved jurisdiction list.",
      evidence: extraction.contractDetails.governingLaw ?? "missing"
    });
  }

  const result: RagValidation = {
    counterpartyApproved,
    requiredClausesPresent,
    terminationNoticeAcceptable,
    liabilityCapAcceptable,
    governingLawAllowed,
    dataProtectionCompliant,
    inconclusive: retrieved.length < 2,
    findings,
    citations: retrieved.map((item) => ({
      policyId: item.document.id,
      title: item.document.title,
      excerpt: item.excerpt
    })),
    reasoningTrace
  };

  return RagValidationSchema.parse(result);
}
