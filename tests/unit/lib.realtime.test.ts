import { beforeEach, describe, expect, test, vi } from "vitest";

describe("realtime helpers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("builds namespace URL from socket origin", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    process.env.NEXT_PUBLIC_SOCKET_URL = "https://ws.example.com";
    process.env.NEXT_PUBLIC_SOCKET_PATH = "/socket.io";

    const mod = await import("@/lib/realtime");
    expect(mod.SOCKET_PATH).toBe("/socket.io");
    expect(mod.getSocketNamespaceUrl("/tracking")).toBe(
      "https://ws.example.com/tracking",
    );
    expect(mod.getSocketClientScriptUrl()).toBe(
      "https://ws.example.com/socket.io/socket.io.js",
    );
  });

  test("falls back to API origin when socket URL is absent", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/v1";
    process.env.NEXT_PUBLIC_SOCKET_URL = "";
    process.env.NEXT_PUBLIC_SOCKET_PATH = "/socket.io";

    const mod = await import("@/lib/realtime");
    expect(mod.getSocketNamespaceUrl("tracking")).toBe(
      "https://api.example.com/tracking",
    );
  });
});

