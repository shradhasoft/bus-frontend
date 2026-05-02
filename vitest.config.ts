import { defineConfig } from "vitest/config";
import path from "node:path";

const sharedResolve = {
  alias: {
    "@": path.resolve(__dirname, "."),
  },
};

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["lib/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/node_modules/**",
        "lib/firebase/**",
        "lib/auth-events.ts",
        "lib/boarding-events.ts",
        "lib/chat-service.ts",
      ],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 40,
        statements: 40,
      },
    },
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: "unit",
          globals: true,
          isolate: true,
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
        },
      },
      {
        resolve: sharedResolve,
        test: {
          name: "integration",
          globals: true,
          isolate: true,
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          include: [
            "tests/integration/**/*.test.ts",
            "tests/integration/**/*.test.tsx",
          ],
        },
      },
    ],
  },
});
