# Contract Intake & Compliance Review Agent

Production-quality assessment project for the Flat Rock Technology Agentic AI Engineer test task. The system receives inbound email webhooks with contract PDF attachments, extracts strict structured JSON, validates the result against an internal RAG policy knowledge base, and deterministically routes the contract to auto-storage or human review.

This project intentionally avoids an invoice use case.

## Business Scenario

Legal Operations receives contract PDFs by email. The agent processes each attachment, extracts contract metadata, validates it against internal policy, stores the audit trail, and flags risky or incomplete contracts for human review.

Clean/high-confidence contracts are auto-stored. Low-confidence, incomplete, risky, unapproved, or policy-violating contracts are routed to review.

## Tech Stack

- Node.js, TypeScript, Express
- Zod for strict runtime schema validation
- `pdf-parse` for PDF text extraction
- Local vector-style RAG retriever over Markdown policy docs
- JSON-file persistence for a self-contained demo
- Prisma PostgreSQL schema included in `prisma/schema.prisma`
- Vitest and Supertest
- Pino structured logging

## Architecture Summary

1. `POST /webhooks/email` accepts multipart email metadata and one PDF attachment.
2. The attachment is copied into `data/attachments`.
3. `pdf-parse` extracts text from multi-page PDFs.
4. The extractor produces strict `ContractExtraction` JSON and validates it with Zod.
5. RAG retrieval searches policy documents in `policies/`.
6. The validator checks approved counterparties, required clauses, termination notice, liability cap, governing law, data protection, and signature rules.
7. Deterministic routing decides `auto-store`, `human-review`, or `rejected-unsupported`.
8. Results, RAG validations, review items, and audit logs are persisted.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm demo:generate-samples
```

If pnpm reports ignored optional build scripts for a transitive dependency, the app and tests still run.

## Environment Variables

See `.env.example`.

- `PORT`: API port, default `3000`
- `DATA_DIR`: local persistence root
- `POLICY_DIR`: RAG policy document directory
- `ATTACHMENT_DIR`: copied attachment storage
- `AUTO_ROUTE_CONFIDENCE_THRESHOLD`: default `0.85`
- `LLM_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`: reserved for production LLM extraction integration

## Run Locally

```bash
pnpm dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Open the basic demo UI:

```text
http://localhost:3000
```

The UI lets you run the clean, missing-field, and risky contract samples, then view auto-store results and the human review queue.

## Simulate Inbound Email

Generate sample PDFs first:

```bash
pnpm demo:generate-samples
```

Send a clean contract:

```bash
curl -X POST http://localhost:3000/webhooks/email \
  -F from=contracts@example.com \
  -F to=intake@flatrock.example \
  -F subject="Clean service agreement" \
  -F messageId="<clean-demo@example.com>" \
  -F attachment=@samples/clean-service-agreement.pdf
```

Run all three demo flows:

```bash
pnpm demo:run
```

Expected routes:

- `clean-service-agreement.pdf`: `auto-store`
- `missing-fields-vendor-agreement.pdf`: `human-review`
- `risky-unapproved-contract.pdf`: `human-review`

## API

- `POST /webhooks/email`: receive email metadata and PDF attachment
- `GET /contracts`: list processed contracts
- `GET /contracts/:id`: get contract extraction and RAG validation
- `GET /review-queue`: list pending and resolved review items
- `POST /review-queue/:id/approve`: approve review item
- `POST /review-queue/:id/reject`: reject review item
- `GET /health`: service health

## Testing

```bash
pnpm typecheck
pnpm lint
pnpm test
```

The test suite covers schema extraction, routing logic, RAG validation, webhook integration, PDF attachment processing, missing fields, low-confidence routing, and approved vs unapproved counterparty checks.

## RAG Value

The RAG layer is not decorative. It retrieves internal policy context from `policies/` and uses it to validate extracted facts against business rules:

- approved client/vendor list
- required confidentiality and data protection clauses
- acceptable termination notice
- liability cap policy
- approved governing law
- signature and approval requirements

The final route is not delegated to the model or retriever. Backend rules make the final deterministic routing decision.

## Known Limitations

- The runnable demo uses deterministic extraction patterns so it can be tested without live LLM credentials.
- `prisma/schema.prisma` models the production PostgreSQL design, while local execution uses JSON persistence for portability.
- OCR for scanned PDFs is not included.

## Future Improvements

- Add OpenAI/Anthropic extraction provider with schema-correction retry.
- Replace JSON persistence with PostgreSQL plus Prisma migrations.
- Add pgvector or Qdrant for scalable policy retrieval.
- Add reviewer UI with evidence highlighting.
- Add OCR fallback for scanned PDFs.

## Documentation

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
