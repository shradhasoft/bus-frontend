"use client";

import type { CSSProperties, ReactNode } from "react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Navbar } from "./dashboard/_components/navbar";
import { Sidebar } from "./dashboard/_components/Sidebar";
import { subscribeAuthSessionChanged } from "@/lib/auth-events";
import { apiUrl } from "@/lib/api";

const SIDEBAR_WIDTH = "17rem";
const SIDEBAR_COLLAPSED_WIDTH = "4.75rem";
const STANDALONE_ROUTES = ["/profile", "/track-journey"];
const ROLE_BASE_PATHS: Record<string, string> = {
  superadmin: "/super-admin/dashboard",
  admin: "/admin/dashboard",
  owner: "/bus-owner/dashboard",
  conductor: "/conductor/dashboard",
  user: "/dashboard",
};
const KNOWN_ROLE_BASE_PATHS = Object.values(ROLE_BASE_PATHS).sort(
  (first, second) => second.length - first.length,
);

const isStandaloneRoute = (pathname: string) =>
  STANDALONE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

const normalizeRole = (role: string | null) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const resolveRouteBasePath = (pathname: string) =>
  KNOWN_ROLE_BASE_PATHS.find(
    (basePath) => pathname === basePath || pathname.startsWith(`${basePath}/`),
  ) ?? null;

const ProtectedShell = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [authSessionVersion, setAuthSessionVersion] = useState(0);
  const [validatedRouteKey, setValidatedRouteKey] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const routeValidationKey = `${authSessionVersion}:${pathname}`;
  const routeValidationKeyRef = useRef(routeValidationKey);
  routeValidationKeyRef.current = routeValidationKey;

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  useEffect(() => {
    return subscribeAuthSessionChanged(() => {
      setAuthSessionVersion((v) => v + 1);
    });
  }, []);

  useEffect(() => {
    if (isStandaloneRoute(pathname)) return;
    if (validatedRouteKey === routeValidationKey) return;

    let cancelled = false;
    const controller = new AbortController();
    const capturedKey = routeValidationKey;

    const enforceRoleRoute = async () => {
      try {
        const response = await fetch(apiUrl("/profile/role"), {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        });

        if (cancelled) return;

        if (!response.ok) {
          if (!cancelled && routeValidationKeyRef.current === capturedKey) {
            setValidatedRouteKey(capturedKey);
          }
          return;
        }

        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;

        const normalizedRole = normalizeRole(payload?.data?.role ?? null);
        const expectedBasePath = ROLE_BASE_PATHS[normalizedRole];

        if (!expectedBasePath) {
          if (!cancelled && routeValidationKeyRef.current === capturedKey) {
            setValidatedRouteKey(capturedKey);
          }
          return;
        }

        const currentBasePath = resolveRouteBasePath(pathname);

        if (!currentBasePath || currentBasePath === expectedBasePath) {
          if (!cancelled && routeValidationKeyRef.current === capturedKey) {
            setValidatedRouteKey(capturedKey);
          }
          return;
        }

        // Wrong path for this role — redirect without router.refresh() to avoid
        // aborting the in-flight fetch. The pathname change will re-trigger this effect.
        router.replace(expectedBasePath);
      } catch (error) {
        if (cancelled || (error as Error).name === "AbortError") return;
        if (process.env.NODE_ENV === "development") {
          console.error("Role route enforcement failed:", error);
        }
        if (!cancelled && routeValidationKeyRef.current === capturedKey) {
          setValidatedRouteKey(capturedKey);
        }
      }
    };

    void enforceRoleRoute();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSessionVersion, pathname]);

  const canRenderChildren =
    isStandaloneRoute(pathname) || validatedRouteKey === routeValidationKey;

  const shellStyle = useMemo(
    () =>
      ({
        "--navbar-height": "64px",
        "--sidebar-width": collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
      }) as CSSProperties,
    [collapsed],
  );

  if (isStandaloneRoute(pathname)) {
    return (
      <main className="min-h-screen bg-slate-50 pt-24 text-slate-900 dark:bg-[#0b1020] dark:text-slate-100">
        {children}
      </main>
    );
  }

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0b1020] dark:text-slate-100"
      style={shellStyle}
    >
      <div className="fixed inset-x-0 top-0 z-50 h-(--navbar-height,64px) md:pl-(--sidebar-width,17rem)">
        <Navbar key={`protected-navbar-${authSessionVersion}`} />
      </div>

      <div
        className="fixed inset-y-0 z-40 hidden transition-[width] duration-300 md:flex"
        style={{ width: "var(--sidebar-width,17rem)" }}
      >
        <Sidebar
          key={`protected-sidebar-${authSessionVersion}`}
          collapsed={collapsed}
          onToggle={toggleSidebar}
        />
      </div>

      <main className="min-h-screen pt-(--navbar-height,64px) transition-[padding] duration-300 md:pl-(--sidebar-width,17rem)">
        <div className="px-6 py-6">
          {canRenderChildren ? (
            <React.Fragment key={authSessionVersion}>{children}</React.Fragment>
          ) : (
            <div className="grid min-h-[40vh] place-items-center rounded-3xl border border-slate-200/80 bg-white/80 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Syncing role access...
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProtectedShell;
