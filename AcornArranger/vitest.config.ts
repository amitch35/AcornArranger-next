import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["lib/**/*.test.{ts,tsx}"],
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
});


