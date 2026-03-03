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
      include: ["lib/**/*.ts", "components/**/*.tsx", "app/**/*.tsx"],
      exclude: ["**/*.d.ts", "**/node_modules/**"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
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
