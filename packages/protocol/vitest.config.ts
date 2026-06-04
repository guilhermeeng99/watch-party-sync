import { defineConfig } from "vitest/config";

// Only run source tests. The build emits compiled copies into dist/, which vitest would otherwise
// also collect and run twice.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
