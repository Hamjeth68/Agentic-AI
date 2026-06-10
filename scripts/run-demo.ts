import request from "supertest";
import path from "node:path";
import { createApp } from "../src/api/app.js";
import { JsonStore } from "../src/db/jsonStore.js";
import { env } from "../src/config/env.js";

const store = new JsonStore(env.DATA_DIR);
await store.reset();
const app = await createApp();

const samples = [
  "clean-service-agreement.pdf",
  "missing-fields-vendor-agreement.pdf",
  "risky-unapproved-contract.pdf"
];

for (const sample of samples) {
  const response = await request(app)
    .post("/webhooks/email")
    .field("from", "contracts@example.com")
    .field("to", "intake@flatrock.example")
    .field("subject", `Contract intake: ${sample}`)
    .field("messageId", `<${sample}@example.com>`)
    .attach("attachment", path.resolve("samples", sample));

  console.log(sample, response.status, response.body.route.route, response.body.route.reasons);
}

const reviewQueue = await request(app).get("/review-queue");
console.log(`Review queue items: ${reviewQueue.body.length}`);
