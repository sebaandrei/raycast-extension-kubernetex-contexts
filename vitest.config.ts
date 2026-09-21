import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // @raycast/api has no Node entry point; tests always mock it, this only lets it resolve.
      "@raycast/api": fileURLToPath(new URL("./src/utils/__tests__/raycast-api-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
