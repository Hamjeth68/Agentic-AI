import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

config();

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.string().default("development"),
  DATA_DIR: z.string().default("./data"),
  POLICY_DIR: z.string().default("./policies"),
  ATTACHMENT_DIR: z.string().default("./data/attachments"),
  LLM_PROVIDER: z.string().default("disabled"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  AUTO_ROUTE_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85)
});

const parsed = EnvSchema.parse(process.env);
const root = process.cwd();

export const env = {
  ...parsed,
  DATA_DIR: path.resolve(root, parsed.DATA_DIR),
  POLICY_DIR: path.resolve(root, parsed.POLICY_DIR),
  ATTACHMENT_DIR: path.resolve(root, parsed.ATTACHMENT_DIR)
};
