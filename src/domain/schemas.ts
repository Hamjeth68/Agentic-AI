import { z } from "zod";

export const DocumentTypeSchema = z.enum([
  "service_agreement",
  "nda",
  "employment_contract",
  "vendor_agreement",
  "unknown"
]);

export const RiskSeveritySchema = z.enum(["low", "medium", "high"]);

export const RiskSchema = z.object({
  riskType: z.string().min(1),
  severity: RiskSeveritySchema,
  description: z.string().min(1),
  evidence: z.string().min(1)
});

export const ContractExtractionSchema = z.object({
  documentType: DocumentTypeSchema,
  parties: z.object({
    companyName: z.string().optional(),
    counterpartyName: z.string().optional(),
    counterpartyAddress: z.string().optional()
  }),
  contractDetails: z.object({
    effectiveDate: z.string().optional(),
    expiryDate: z.string().optional(),
    renewalTerms: z.string().optional(),
    governingLaw: z.string().optional(),
    paymentTerms: z.string().optional(),
    terminationNoticeDays: z.number().int().nonnegative().optional(),
    liabilityCap: z.string().optional(),
    confidentialityClausePresent: z.boolean(),
    dataProtectionClausePresent: z.boolean(),
    signatureStatus: z.enum(["signed", "unsigned", "partially_signed", "unknown"])
  }),
  risks: z.array(RiskSchema),
  missingFields: z.array(z.string()),
  confidence: z.object({
    overall: z.number().min(0).max(1),
    fieldConfidence: z.record(z.string(), z.number().min(0).max(1))
  }),
  evidence: z.record(z.string(), z.string()).default({})
});

export type ContractExtraction = z.infer<typeof ContractExtractionSchema>;

export const EmailWebhookSchema = z.object({
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string().min(1),
  messageId: z.string().min(1),
  receivedAt: z.string().datetime().optional(),
  textBody: z.string().optional()
});

export type EmailWebhookPayload = z.infer<typeof EmailWebhookSchema>;

export const RagValidationSchema = z.object({
  counterpartyApproved: z.boolean(),
  requiredClausesPresent: z.boolean(),
  terminationNoticeAcceptable: z.boolean(),
  liabilityCapAcceptable: z.boolean(),
  governingLawAllowed: z.boolean(),
  dataProtectionCompliant: z.boolean(),
  inconclusive: z.boolean(),
  findings: z.array(RiskSchema),
  citations: z.array(
    z.object({
      policyId: z.string(),
      title: z.string(),
      excerpt: z.string()
    })
  ),
  reasoningTrace: z.array(z.string())
});

export type RagValidation = z.infer<typeof RagValidationSchema>;

export const RouteDecisionSchema = z.object({
  route: z.enum(["auto-store", "human-review", "rejected-unsupported"]),
  recommendedAction: z.string(),
  reasons: z.array(z.string())
});

export type RouteDecision = z.infer<typeof RouteDecisionSchema>;
