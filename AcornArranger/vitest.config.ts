import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["lib/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});


