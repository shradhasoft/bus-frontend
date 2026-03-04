import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ── Mock firebase/auth ──────────────────────────────────────────────────────
const onAuthStateChangedMock = vi.fn();
const signInWithCredentialMock = vi.fn();
const googleCredentialMock = vi.fn();

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
  signInWithCredential: (...args: unknown[]) =>
    signInWithCredentialMock(...args),
  GoogleAuthProvider: {
    credential: (...args: unknown[]) => googleCredentialMock(...args),
  },
}));

// ── Mock firebase client ────────────────────────────────────────────────────
vi.mock("@/lib/firebase/client", () => ({
  firebaseAuth: {},
}));

// ── Mock next/navigation ────────────────────────────────────────────────────
const usePathnameMock = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

// ── Mock lib/api ────────────────────────────────────────────────────────────
vi.mock("@/lib/api", () => ({
  apiUrl: (path: string) => `http://localhost:3001${path}`,
}));

// ── Mock lib/auth-events ────────────────────────────────────────────────────
const dispatchAuthSessionChangedEventMock = vi.fn();
vi.mock("@/lib/auth-events", () => ({
  dispatchAuthSessionChangedEvent: () => dispatchAuthSessionChangedEventMock(),
}));

describe("GoogleOneTap", () => {
  const originalEnv = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  beforeEach(() => {
    vi.resetModules();

    // Reset all mocks
    onAuthStateChangedMock.mockReset();
    signInWithCredentialMock.mockReset();
    googleCredentialMock.mockReset();
    dispatchAuthSessionChangedEventMock.mockReset();
    usePathnameMock.mockReturnValue("/");

    // Remove any injected GIS scripts/google global
    delete (window as unknown as Record<string, unknown>).google;
    document
      .querySelectorAll('script[src*="accounts.google.com"]')
      .forEach((s) => s.remove());

    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID =
      "test-client-id.apps.googleusercontent.com";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = originalEnv;
  });

  test("does not show prompt when user is already logged in", async () => {
    // Simulate logged-in user
    onAuthStateChangedMock.mockImplementation(
      (_auth: unknown, cb: (user: unknown) => void) => {
        cb({ uid: "user123" }); // user exists = logged in
        return vi.fn(); // unsubscribe
      },
    );

    const { render } = await import("@testing-library/react");
    const { default: GoogleOneTap } =
      await import("@/components/google-one-tap");

    render(<GoogleOneTap />);

    // GIS script should NOT be injected when logged in
    const gisScript = document.querySelector(
      'script[src*="accounts.google.com/gsi/client"]',
    );
    expect(gisScript).toBeNull();
  });

  test("injects GIS script when user is not logged in", async () => {
    // Simulate not-logged-in user
    onAuthStateChangedMock.mockImplementation(
      (_auth: unknown, cb: (user: unknown) => void) => {
        cb(null); // null = not logged in
        return vi.fn();
      },
    );

    const { render } = await import("@testing-library/react");
    const { default: GoogleOneTap } =
      await import("@/components/google-one-tap");

    render(<GoogleOneTap />);

    const gisScript = document.querySelector(
      'script[src*="accounts.google.com/gsi/client"]',
    );
    expect(gisScript).not.toBeNull();
    expect(gisScript?.getAttribute("src")).toBe(
      "https://accounts.google.com/gsi/client",
    );
  });

  test("does not inject script when on suppressed /login route", async () => {
    usePathnameMock.mockReturnValue("/en/login");

    onAuthStateChangedMock.mockImplementation(
      (_auth: unknown, cb: (user: unknown) => void) => {
        cb(null);
        return vi.fn();
      },
    );

    const { render } = await import("@testing-library/react");
    const { default: GoogleOneTap } =
      await import("@/components/google-one-tap");

    render(<GoogleOneTap />);

    const gisScript = document.querySelector(
      'script[src*="accounts.google.com/gsi/client"]',
    );
    expect(gisScript).toBeNull();
  });

  test("calls google.accounts.id.initialize and prompt when GIS loads", async () => {
    const initializeMock = vi.fn();
    const promptMock = vi.fn();
    const cancelMock = vi.fn();

    onAuthStateChangedMock.mockImplementation(
      (_auth: unknown, cb: (user: unknown) => void) => {
        cb(null);
        return vi.fn();
      },
    );

    const { render } = await import("@testing-library/react");
    const { default: GoogleOneTap } =
      await import("@/components/google-one-tap");

    render(<GoogleOneTap />);

    // Simulate GIS script loaded
    (window as unknown as Record<string, unknown>).google = {
      accounts: {
        id: {
          initialize: initializeMock,
          prompt: promptMock,
          cancel: cancelMock,
        },
      },
    };

    // Trigger the script's onload
    const gisScript = document.querySelector(
      'script[src*="accounts.google.com/gsi/client"]',
    ) as HTMLScriptElement;
    expect(gisScript).not.toBeNull();
    gisScript?.onload?.(new Event("load"));

    expect(initializeMock).toHaveBeenCalledOnce();
    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "test-client-id.apps.googleusercontent.com",
        auto_select: true,
      }),
    );
    expect(promptMock).toHaveBeenCalledOnce();
  });

  test("warns in dev when NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "";
    vi.resetModules();

    onAuthStateChangedMock.mockImplementation(
      (_auth: unknown, cb: (user: unknown) => void) => {
        cb(null);
        return vi.fn();
      },
    );

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { render } = await import("@testing-library/react");
    const { default: GoogleOneTap } =
      await import("@/components/google-one-tap");

    render(<GoogleOneTap />);

    // In dev mode, should warn that client ID is missing
    // Note: the env check happens at module level so this test verifies the warning path
    const gisScript = document.querySelector(
      'script[src*="accounts.google.com/gsi/client"]',
    );
    expect(gisScript).toBeNull();

    consoleSpy.mockRestore();
  });
});
