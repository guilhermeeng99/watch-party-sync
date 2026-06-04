import { defineConfig } from "vitest/config";

// Run only source unit tests for pure logic (providers, sync math). The WXT build output lives in
// .output/ and is not collected.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
