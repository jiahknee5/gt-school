import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": root, "@/": `${root}/` },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // R1 needs a real DB; the suite stays green pre-keys by skipping in-test.
    testTimeout: 20000,
  },
});
