import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.integration.test.ts"],
    // @workspace/db requires DATABASE_URL at import time; unit tests do not hit the DB.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@127.0.0.1:5432/karm_baba_test",
    },
  },
});
