import { beforeEach } from "vitest";
import { JsonStore } from "../src/db/jsonStore.js";
import { env } from "../src/config/env.js";

beforeEach(async () => {
  await new JsonStore(env.DATA_DIR).reset();
});
