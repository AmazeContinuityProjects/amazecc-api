import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` -> `./src/*` mapping in tsconfig.json.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // `mask.ts` reads ID_SALT at import time. Tests must never touch the real
    // salt, so pin a fixed test value here rather than relying on the shell.
    env: {
      ID_SALT: "test-salt-for-unit-tests-only",
    },
  },
});
