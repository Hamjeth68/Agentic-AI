import { createApp } from "./api/app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const app = await createApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "contract intake agent listening");
});
