import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock socket.io-client before importing the module under test
const mockSocket = {
  disconnect: vi.fn(),
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

describe("socket lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("initSocket creates a socket on first call", async () => {
    const { initSocket } = await import("@/lib/socket");
    const socket = initSocket("test-token");
    expect(socket).toBeDefined();
    expect(socket).toBe(mockSocket);
  });

  test("initSocket reuses existing socket on subsequent calls", async () => {
    const { initSocket } = await import("@/lib/socket");
    const first = initSocket("token-1");
    const second = initSocket("token-2");
    expect(first).toBe(second);
  });

  test("getSocket returns null before init", async () => {
    const { getSocket } = await import("@/lib/socket");
    expect(getSocket()).toBeNull();
  });

  test("disconnectSocket disconnects and clears the reference", async () => {
    const { initSocket, disconnectSocket, getSocket } =
      await import("@/lib/socket");
    initSocket();
    disconnectSocket();
    expect(mockSocket.disconnect).toHaveBeenCalledOnce();
    expect(getSocket()).toBeNull();
  });
});
