import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import { stat } from "node:fs/promises";
import { pinoHttp } from "pino-http";
import { env } from "../config/env.js";
import { EmailWebhookSchema } from "../domain/schemas.js";
import { JsonStore } from "../db/jsonStore.js";
import { LocalVectorStore } from "../rag/vectorStore.js";
import { ContractProcessor } from "../services/processor.js";
import { logger } from "../utils/logger.js";

export async function createApp() {
  const app = express();
  const upload = multer({ dest: `${env.DATA_DIR}/tmp` });
  const store = new JsonStore(env.DATA_DIR);
  const vectorStore = new LocalVectorStore();
  await vectorStore.load(env.POLICY_DIR);
  const processor = new ContractProcessor(store, vectorStore);

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(pinoHttp({ logger }));
  app.use(express.static(path.resolve(process.cwd(), "public")));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "contract-intake-compliance-agent" });
  });

  app.post("/webhooks/email", upload.single("attachment"), async (req, res, next) => {
    try {
      const payload = EmailWebhookSchema.parse(req.body);
      if (!req.file) {
        res.status(400).json({ error: "attachment is required" });
        return;
      }
      const result = await processor.process(payload, {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        path: req.file.path,
        sizeBytes: req.file.size
      });
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/demo/samples/:sampleName", async (req, res, next) => {
    try {
      const samples: Record<string, string> = {
        clean: "clean-service-agreement.pdf",
        missing: "missing-fields-vendor-agreement.pdf",
        risky: "risky-unapproved-contract.pdf"
      };
      const fileName = samples[req.params.sampleName];
      if (!fileName) {
        res.status(404).json({ error: "sample not found" });
        return;
      }
      const samplePath = path.resolve(process.cwd(), "samples", fileName);
      const fileStat = await stat(samplePath);
      const result = await processor.process(
        {
          from: "contracts@example.com",
          to: "intake@flatrock.example",
          subject: `Demo sample: ${fileName}`,
          messageId: `<${req.params.sampleName}-${Date.now()}@demo.local>`,
          receivedAt: new Date().toISOString()
        },
        {
          originalName: fileName,
          mimeType: "application/pdf",
          path: samplePath,
          sizeBytes: fileStat.size
        }
      );
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/contracts", async (_req, res) => {
    const db = await store.read();
    res.json(db.contract_extractions);
  });

  app.get("/contracts/:id", async (req, res) => {
    const db = await store.read();
    const contract = db.contract_extractions.find((item) => item.id === req.params.id);
    if (!contract) {
      res.status(404).json({ error: "contract not found" });
      return;
    }
    const validation = db.rag_validation_results.find((item) => item.contractId === contract.id);
    res.json({ ...contract, ragValidation: validation?.validation });
  });

  app.get("/review-queue", async (_req, res) => {
    const db = await store.read();
    res.json(
      db.human_review_items.map((item) => ({
        ...item,
        contract: db.contract_extractions.find((contract) => contract.id === item.contractId),
        ragValidation: db.rag_validation_results.find((validation) => validation.contractId === item.contractId)?.validation
      }))
    );
  });

  app.post("/review-queue/:id/approve", async (req, res) => {
    const item = await store.updateReview(req.params.id, "approved");
    if (!item) {
      res.status(404).json({ error: "review item not found" });
      return;
    }
    res.json(item);
  });

  app.post("/review-queue/:id/reject", async (req, res) => {
    const item = await store.updateReview(req.params.id, "rejected");
    if (!item) {
      res.status(404).json({ error: "review item not found" });
      return;
    }
    res.json(item);
  });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    reqLog(error);
    res.status(400).json({ error: error.message });
  });

  return app;
}

function reqLog(error: Error) {
  logger.warn({ error }, "request failed");
}
