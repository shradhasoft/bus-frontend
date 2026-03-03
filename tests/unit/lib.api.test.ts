import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
});

describe("apiUrl", () => {
  test("uses relative paths when no base URL is configured", async () => {
    const original = process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.resetModules();
    const apiModule = await import("@/lib/api");

    expect(apiModule.apiUrl("/health/live")).toBe("/health/live");
    expect(apiModule.apiUrl("health/live")).toBe("/health/live");

    process.env.NEXT_PUBLIC_API_BASE_URL = original;
  });

  test("dedupes /api boundary when base already includes api", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://example.com/api";
    vi.resetModules();
    const apiModule = await import("@/lib/api");

    expect(apiModule.apiUrl("/api/notifications")).toBe(
      "https://example.com/api/notifications",
    );
  });
});
