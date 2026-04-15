/**
 * Bug Condition Exploration Test — Self-Role-Change Missing Auth Event and Redirect
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * Bug Condition:
 *   isBugCondition(X) = X.formMode === "edit" AND X.editedUserId === X.currentUserId
 *
 * This test MUST FAIL on unfixed code — that failure confirms the bug exists.
 * When the fix is applied (task 3), this test will pass, confirming the fix works.
 *
 * Expected behavior (correct):
 *   - dispatchAuthSessionChangedEvent() IS called
 *   - router.replace("/dashboard") IS called
 *
 * Actual behavior (unfixed):
 *   - dispatchAuthSessionChangedEvent() is NOT called  ← bug
 *   - router.replace() is NOT called                   ← bug
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
const CURRENT_USER_ID = "user-1";

/**
 * Build a mock fetch that handles the three endpoints the component calls:
 *   GET /profile/me          → current user identity
 *   GET /admin/users?...     → users list
 *   PATCH /admin/users/:id   → successful role update
 */
function buildFetchMock() {
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
                _id: CURRENT_USER_ID,
                fullName: "Test Admin",
                email: "admin@test.com",
                role: "superadmin",
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

    // PATCH /admin/users/:id
    if (urlStr.includes("/admin/users") && init?.method === "PATCH") {
      return new Response(
        JSON.stringify({ data: { _id: CURRENT_USER_ID, role: "user" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fallback — should not be reached
    return new Response(JSON.stringify({ message: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("ManageUsersPage — Bug Condition: Self-Role-Change", () => {
  let fetchMock: ReturnType<typeof buildFetchMock>;

  beforeEach(() => {
    vi.resetModules();
    routerReplaceMock.mockReset();
    dispatchAuthSessionChangedEventMock.mockReset();

    fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test(
    "Property 1 (Bug Condition): when admin changes their OWN role, " +
      "dispatchAuthSessionChangedEvent IS called and router.replace IS called with the new role dashboard path",
    async () => {
      /**
       * **Validates: Requirements 1.1, 1.2**
       *
       * Bug Condition: formMode === "edit" AND editedUserId === currentUserId
       *
       * This test FAILS on unfixed code because:
       *   - dispatchAuthSessionChangedEvent is never called (bug)
       *   - router.replace is never called (bug)
       *
       * When the fix is applied, this test will PASS.
       */
      const { default: ManageUsersPage } =
        await import("@/app/[locale]/(protected)/super-admin/dashboard/manage-users/page");

      const user = userEvent.setup();
      render(<ManageUsersPage />);

      // Wait for the users list to load (GET /admin/users response)
      await waitFor(() => {
        expect(screen.getByText("Test Admin")).toBeInTheDocument();
      });

      // Open the edit dialog for the user with _id: "user-1" (the current user)
      const editButton = screen.getByRole("button", { name: /edit/i });
      await user.click(editButton);

      // Wait for the dialog to open
      await waitFor(() => {
        expect(screen.getByTestId("dialog")).toBeInTheDocument();
      });

      // Change the role to "user" — scope to the dialog to avoid the page-size select
      const dialog = screen.getByTestId("dialog-content");
      const roleSelect = dialog.querySelector("select") as HTMLSelectElement;
      expect(roleSelect).not.toBeNull();
      await user.selectOptions(roleSelect, "user");

      // Submit the form
      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      // Assert that dispatchAuthSessionChangedEvent WAS called
      // (FAILS on unfixed code — confirming the bug)
      await waitFor(() => {
        expect(dispatchAuthSessionChangedEventMock).toHaveBeenCalledOnce();
      });

      // Assert that router.replace WAS called with "/dashboard"
      // (FAILS on unfixed code — confirming the bug)
      expect(routerReplaceMock).toHaveBeenCalledWith("/dashboard");
    },
  );
});
