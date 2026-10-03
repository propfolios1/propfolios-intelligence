import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: path.resolve(import.meta.dirname, "tests/stubs/server-only.ts") },
      { find: /^@\//, replacement: `${path.resolve(import.meta.dirname)}/` },
    ],
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
