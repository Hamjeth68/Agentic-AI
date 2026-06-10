import { env } from "../config/env.js";
import { ContractExtraction, RagValidation, RouteDecision } from "../domain/schemas.js";

export function decideRoute(extraction: ContractExtraction, validation: RagValidation): RouteDecision {
  const reasons: string[] = [];
  const highRisks = [...extraction.risks, ...validation.findings].filter((risk) => risk.severity === "high");

  if (extraction.documentType === "unknown") reasons.push("document type is unknown");
  if (extraction.confidence.overall < env.AUTO_ROUTE_CONFIDENCE_THRESHOLD) reasons.push("overall confidence is below threshold");
  if (extraction.missingFields.length > 0) reasons.push(`missing required fields: ${extraction.missingFields.join(", ")}`);
  if (highRisks.length > 0) reasons.push(`high severity risks found: ${highRisks.map((risk) => risk.riskType).join(", ")}`);
  if (!validation.counterpartyApproved) reasons.push("counterparty did not pass RAG approval validation");
  if (!validation.requiredClausesPresent) reasons.push("required clauses did not pass RAG validation");
  if (validation.inconclusive) reasons.push("RAG validation was inconclusive");

  if (extraction.documentType === "unknown" && extraction.confidence.overall < 0.35) {
    return {
      route: "rejected-unsupported",
      recommendedAction: "Reject unsupported or unparseable attachment and request a clearer contract PDF.",
      reasons
    };
  }

  if (reasons.length > 0) {
    return {
      route: "human-review",
      recommendedAction: "Send to legal operations for manual review before storage.",
      reasons
    };
  }

  return {
    route: "auto-store",
    recommendedAction: "Store contract record automatically.",
    reasons: ["all deterministic routing gates passed"]
  };
}
