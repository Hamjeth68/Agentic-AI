import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["tests/setup.ts"],
    exclude: ["node_modules/**", "dist/**"],
    sequence: { concurrent: false },
    fileParallelism: false
  }
});
