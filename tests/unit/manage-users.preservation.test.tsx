/**
 * Preservation Property Tests — Non-Self Edits Preserve Existing Behavior
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Preservation Property:
 *   FOR ALL X WHERE NOT isBugCondition(X) DO
 *     ASSERT handleFormSubmit(X) = handleFormSubmit_fixed(X)
 *     // i.e. loadUsers called, form closed, no redirect, no auth event
 *   END FOR
 *
 * Where isBugCondition(X) is FALSE when:
 *   - formMode !== "edit"  (create or view mode)
 *   - editedUserId !== currentUserId  (editing another user)
 *   - currentUserId is null  (fetch failed — safe degradation)
 *
 * These tests MUST PASS on CURRENT (unfixed) code — they capture the baseline
 * behavior that must not regress after the fix is applied.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ── Mock next/navigation ────────────────────────────────────────────────────
const routerReplaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// ── Mock lib/auth-events ────────────────────────────────────────────────────
const dispatchAuthSessionChangedEventMock = vi.fn();
vi.mock("@/lib/auth-events", () => ({
  dispatchAuthSessionChangedEvent: () => dispatchAuthSessionChangedEventMock(),
  subscribeAuthSessionChanged: vi.fn(() => () => {}),
  AUTH_SESSION_CHANGED_EVENT: "auth:session-changed",
}));

// ── Mock lib/api ────────────────────────────────────────────────────────────
vi.mock("@/lib/api", () => ({
  apiUrl: (path: string) => path,
}));

// ── Mock next-intl ──────────────────────────────────────────────────────────
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

// ── Mock UI components that may have complex dependencies ───────────────────
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
  }) => <button {...props}>{children}</button>,
}));

// ── Constants ───────────────────────────────────────────────────────────────
const CURRENT_USER_ID = "current-user-id";
const OTHER_USER_ID = "other-user-id";

/**
 * Build a mock fetch for the "other-user edit" scenario.
 * GET /profile/me returns currentUserId = "current-user-id"
 * The users list contains a user with _id = "other-user-id" (different from current user)
 */
function buildOtherUserFetchMock() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const urlStr = String(url);

    // GET /profile/me — returns the current user's ID
    if (urlStr.includes("/profile/me")) {
      return new Response(JSON.stringify({ data: { _id: CURRENT_USER_ID } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /admin/users — returns a list with a different user
    if (
      urlStr.includes("/admin/users") &&
      (!init?.method || init.method === "GET")
    ) {
      return new Response(
        JSON.stringify({
          data: {
            users: [
              {
                _id: OTHER_USER_ID,
                fullName: "Other User",
                email: "other@test.com",
                role: "user",
                isActive: true,
                isBlocked: false,
              },
            ],
            total: 1,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // PATCH /admin/users/:id — successful role update
    if (urlStr.includes("/admin/users") && init?.method === "PATCH") {
      return new Response(
        JSON.stringify({ data: { _id: OTHER_USER_ID, role: "admin" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ message: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  });
}

/**
 * Build a mock fetch for the "create mode" scenario.
 * GET /profile/me returns currentUserId = "current-user-id"
 * POST /admin/users — successful user creation
 */
function buildCreateModeFetchMock() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const urlStr = String(url);

    // GET /profile/me
    if (urlStr.includes("/profile/me")) {
      return new Response(JSON.stringify({ data: { _id: CURRENT_USER_ID } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /admin/users
    if (
      urlStr.includes("/admin/users") &&
      (!init?.method || init.method === "GET")
    ) {
      return new Response(
        JSON.stringify({
          data: {
            users: [
              {
                _id: OTHER_USER_ID,
                fullName: "Existing User",
                email: "existing@test.com",
                role: "user",
                isActive: true,
                isBlocked: false,
              },
            ],
            total: 1,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // POST /admin/users — successful creation
    if (urlStr.includes("/admin/users") && init?.method === "POST") {
      return new Response(
        JSON.stringify({
          data: { _id: "new-user-id", email: "new@test.com", role: "user" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ message: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  });
}

/**
 * Build a mock fetch for the "currentUserId null" scenario.
 * GET /profile/me returns 401 (fetch fails — currentUserId stays null)
 * The users list contains a user with _id = "user-1"
 */
function buildNullCurrentUserFetchMock() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const urlStr = String(url);

    // GET /profile/me — returns 401 (simulates auth failure)
    if (urlStr.includes("/profile/me")) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /admin/users
    if (
      urlStr.includes("/admin/users") &&
      (!init?.method || init.method === "GET")
    ) {
      return new Response(
        JSON.stringify({
          data: {
            users: [
              {
                _id: "user-1",
                fullName: "Some User",
                email: "someuser@test.com",
                role: "user",
                isActive: true,
                isBlocked: false,
              },
            ],
            total: 1,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // PATCH /admin/users/:id — successful role update
    if (urlStr.includes("/admin/users") && init?.method === "PATCH") {
      return new Response(
        JSON.stringify({ data: { _id: "user-1", role: "admin" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ message: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("ManageUsersPage — Preservation: Non-Self Edits Preserve Existing Behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    routerReplaceMock.mockReset();
    dispatchAuthSessionChangedEventMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test(
    "Property 2 (Preservation — other-user edit): when admin edits a DIFFERENT user's role, " +
      "loadUsers is called, dispatchAuthSessionChangedEvent is NOT called, router.replace is NOT called",
    async () => {
      /**
       * **Validates: Requirements 3.1**
       *
       * Preservation condition: editedUserId ("other-user-id") !== currentUserId ("current-user-id")
       *
       * Expected behavior (preserved on both unfixed and fixed code):
       *   - fetch is called with GET /admin/users after the PATCH (loadUsers reloads)
       *   - dispatchAuthSessionChangedEvent is NOT called
       *   - router.replace is NOT called
       */
      const fetchMock = buildOtherUserFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      const { default: ManageUsersPage } =
        await import("@/app/[locale]/(protected)/super-admin/dashboard/manage-users/page");

      const user = userEvent.setup();
      render(<ManageUsersPage />);

      // Wait for the users list to load
      await waitFor(() => {
        expect(screen.getByText("Other User")).toBeInTheDocument();
      });

      // Open the edit dialog for the other user
      const editButton = screen.getByRole("button", { name: /edit/i });
      await user.click(editButton);

      // Wait for the dialog to open
      await waitFor(() => {
        expect(screen.getByTestId("dialog")).toBeInTheDocument();
      });

      // Change the role
      const dialog = screen.getByTestId("dialog-content");
      const roleSelect = dialog.querySelector("select") as HTMLSelectElement;
      expect(roleSelect).not.toBeNull();
      await user.selectOptions(roleSelect, "admin");

      // Record fetch call count before submit
      const fetchCallsBefore = fetchMock.mock.calls.length;

      // Submit the form
      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      // Assert: loadUsers was called (GET /admin/users after the PATCH)
      await waitFor(() => {
        const getAdminUsersCalls = fetchMock.mock.calls.filter(
          ([url, init]: [string, RequestInit | undefined]) =>
            String(url).includes("/admin/users") &&
            (!init?.method || init.method === "GET"),
        );
        // There should be at least one GET /admin/users call after the PATCH
        expect(getAdminUsersCalls.length).toBeGreaterThan(
          fetchMock.mock.calls
            .slice(0, fetchCallsBefore)
            .filter(
              ([url, init]: [string, RequestInit | undefined]) =>
                String(url).includes("/admin/users") &&
                (!init?.method || init.method === "GET"),
            ).length,
        );
      });

      // Assert: dispatchAuthSessionChangedEvent was NOT called
      expect(dispatchAuthSessionChangedEventMock).not.toHaveBeenCalled();

      // Assert: router.replace was NOT called
      expect(routerReplaceMock).not.toHaveBeenCalled();
    },
  );

  test(
    "Property 2 (Preservation — create mode): when admin creates a new user, " +
      "loadUsers is called, dispatchAuthSessionChangedEvent is NOT called, router.replace is NOT called",
    async () => {
      /**
       * **Validates: Requirements 3.2**
       *
       * Preservation condition: formMode === "create" (not "edit")
       *
       * Expected behavior (preserved on both unfixed and fixed code):
       *   - fetch is called with GET /admin/users after the POST (loadUsers reloads)
       *   - dispatchAuthSessionChangedEvent is NOT called
       *   - router.replace is NOT called
       */
      const fetchMock = buildCreateModeFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      const { default: ManageUsersPage } =
        await import("@/app/[locale]/(protected)/super-admin/dashboard/manage-users/page");

      const user = userEvent.setup();
      render(<ManageUsersPage />);

      // Wait for the users list to load
      await waitFor(() => {
        expect(screen.getByText("Existing User")).toBeInTheDocument();
      });

      // Click "Add User" to open the create dialog
      const addUserButton = screen.getByRole("button", { name: /add user/i });
      await user.click(addUserButton);

      // Wait for the dialog to open
      await waitFor(() => {
        expect(screen.getByTestId("dialog")).toBeInTheDocument();
      });

      // Fill in the email field (required for create mode)
      const dialog = screen.getByTestId("dialog-content");
      const emailInput = dialog.querySelector(
        'input[type="email"]',
      ) as HTMLInputElement;
      expect(emailInput).not.toBeNull();
      await user.type(emailInput, "newuser@test.com");

      // Record fetch call count before submit
      const fetchCallsBefore = fetchMock.mock.calls.length;

      // Submit the form
      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      // Assert: loadUsers was called (GET /admin/users after the POST)
      await waitFor(() => {
        const getAdminUsersCalls = fetchMock.mock.calls.filter(
          ([url, init]: [string, RequestInit | undefined]) =>
            String(url).includes("/admin/users") &&
            (!init?.method || init.method === "GET"),
        );
        expect(getAdminUsersCalls.length).toBeGreaterThan(
          fetchMock.mock.calls
            .slice(0, fetchCallsBefore)
            .filter(
              ([url, init]: [string, RequestInit | undefined]) =>
                String(url).includes("/admin/users") &&
                (!init?.method || init.method === "GET"),
            ).length,
        );
      });

      // Assert: dispatchAuthSessionChangedEvent was NOT called
      expect(dispatchAuthSessionChangedEventMock).not.toHaveBeenCalled();

      // Assert: router.replace was NOT called
      expect(routerReplaceMock).not.toHaveBeenCalled();
    },
  );

  test(
    "Property 2 (Preservation — currentUserId null / safe degradation): " +
      "when GET /profile/me returns 401 (currentUserId is null), " +
      "editing any user still calls loadUsers, does NOT call dispatchAuthSessionChangedEvent, does NOT call router.replace",
    async () => {
      /**
       * **Validates: Requirements 3.3**
       *
       * Preservation condition: currentUserId is null (GET /profile/me failed)
       *
       * Expected behavior (preserved on both unfixed and fixed code):
       *   - fetch is called with GET /admin/users after the PATCH (loadUsers reloads)
       *   - dispatchAuthSessionChangedEvent is NOT called
       *   - router.replace is NOT called
       *   - No crash — safe degradation
       */
      const fetchMock = buildNullCurrentUserFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      const { default: ManageUsersPage } =
        await import("@/app/[locale]/(protected)/super-admin/dashboard/manage-users/page");

      const user = userEvent.setup();
      render(<ManageUsersPage />);

      // Wait for the users list to load (even though /profile/me failed)
      await waitFor(() => {
        expect(screen.getByText("Some User")).toBeInTheDocument();
      });

      // Open the edit dialog for the user
      const editButton = screen.getByRole("button", { name: /edit/i });
      await user.click(editButton);

      // Wait for the dialog to open
      await waitFor(() => {
        expect(screen.getByTestId("dialog")).toBeInTheDocument();
      });

      // Change the role
      const dialog = screen.getByTestId("dialog-content");
      const roleSelect = dialog.querySelector("select") as HTMLSelectElement;
      expect(roleSelect).not.toBeNull();
      await user.selectOptions(roleSelect, "admin");

      // Record fetch call count before submit
      const fetchCallsBefore = fetchMock.mock.calls.length;

      // Submit the form
      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      // Assert: loadUsers was called (GET /admin/users after the PATCH)
      await waitFor(() => {
        const getAdminUsersCalls = fetchMock.mock.calls.filter(
          ([url, init]: [string, RequestInit | undefined]) =>
            String(url).includes("/admin/users") &&
            (!init?.method || init.method === "GET"),
        );
        expect(getAdminUsersCalls.length).toBeGreaterThan(
          fetchMock.mock.calls
            .slice(0, fetchCallsBefore)
            .filter(
              ([url, init]: [string, RequestInit | undefined]) =>
                String(url).includes("/admin/users") &&
                (!init?.method || init.method === "GET"),
            ).length,
        );
      });

      // Assert: dispatchAuthSessionChangedEvent was NOT called (safe degradation)
      expect(dispatchAuthSessionChangedEventMock).not.toHaveBeenCalled();

      // Assert: router.replace was NOT called (safe degradation)
      expect(routerReplaceMock).not.toHaveBeenCalled();
    },
  );
});
