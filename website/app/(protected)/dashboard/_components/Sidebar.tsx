"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Banknote,
  Bus,
  ArrowUp,
  CalendarCheck2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  MapPinned,
  MessageSquareText,
  Moon,
  Sun,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { dispatchAuthSessionChangedEvent } from "@/lib/auth-events";

type NavItem = {
  label: string;
  icon: LucideIcon;
};

type ImpersonationStatus = {
  active: boolean;
  actor?: {
    _id?: string | null;
    fullName?: string | null;
    role?: string | null;
  } | null;
  target?: {
    _id?: string | null;
    fullName?: string | null;
    role?: string | null;
  } | null;
};

const NAV_ITEMS_BY_ROLE: Record<string, NavItem[]> = {
  superadmin: [
    { label: "Dashboard", icon: Activity },
    { label: "Manage Buses", icon: Bus },
    { label: "Track Bus", icon: MapPinned },
    { label: "Manage Bookings", icon: ClipboardList },
    { label: "Manage Users", icon: Users },
    { label: "Manage Offers", icon: BadgeCheck },
    { label: "Manage Transactions", icon: Banknote },
    { label: "Callback Requests", icon: CalendarCheck2 },
    { label: "Manage Tickets", icon: FileText },
    { label: "Broadcast", icon: MessageSquareText },
  ],
  admin: [
    { label: "Dashboard", icon: Activity },
    { label: "Manage Buses", icon: Bus },
    { label: "Track Bus", icon: MapPinned },
    { label: "Manage Bookings", icon: ClipboardList },
    { label: "Manage Users", icon: Users },
    { label: "Manage Offers", icon: BadgeCheck },
    { label: "Manage Transactions", icon: Banknote },
    { label: "Callback Requests", icon: CalendarCheck2 },
    { label: "Manage Tickets", icon: FileText },
    { label: "Broadcast", icon: MessageSquareText },
  ],
  conductor: [
    { label: "Dashboard", icon: Activity },
    { label: "Manage Bus", icon: Bus },
    { label: "Mark Offline Book", icon: FileText },
  ],
  owner: [
    { label: "Dashboard", icon: Activity },
    { label: "Manage conductor", icon: User },
    { label: "Manage Buses", icon: Bus },
    { label: "Track Bus", icon: MapPinned },
  ],
};

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: Activity },
];

const ROLE_BASE_PATHS: Record<string, string> = {
  superadmin: "/super-admin/dashboard",
  admin: "/admin/dashboard",
  owner: "/bus-owner/dashboard",
  conductor: "/conductor/dashboard",
  user: "/dashboard",
};

const KNOWN_BASE_PATHS = Object.values(ROLE_BASE_PATHS);

const normalizeRole = (role: string | null) =>
  role?.toLowerCase().replace(/[\s_-]+/g, "") ?? "";

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const tooltipLabel = collapsed
    ? "Expand (⌘/Ctrl + B)"
    : "Collapse (⌘/Ctrl + B)";
  const { setTheme, resolvedTheme } = useTheme();
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [impersonationStatus, setImpersonationStatus] = useState<ImpersonationStatus>({
    active: false,
  });
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);
  const [activeItem, setActiveItem] = useState<string>("Dashboard");
  const themeReady = typeof resolvedTheme === "string";
  const isDark = resolvedTheme === "dark";
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadRole = async () => {
      try {
        const response = await fetch(apiUrl("/profile/role"), {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          if (active) setProfileRole(null);
          return;
        }

        const data = await response.json().catch(() => ({}));
        const role = data?.data?.role;

        if (active) {
          setProfileRole(typeof role === "string" ? role : null);
        }
      } catch (error) {
        if (active && (error as Error).name !== "AbortError") {
          console.error("Failed to load user role:", error);
          setProfileRole(null);
        }
      }
    };

    loadRole();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadImpersonationStatus = async () => {
      try {
        const response = await fetch(apiUrl("/admin/impersonation/status"), {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          if (mounted) setImpersonationStatus({ active: false });
          return;
        }

        const payload = await response.json().catch(() => ({}));
        const data = payload?.data ?? {};
        if (!mounted) return;

        setImpersonationStatus({
          active: data?.active === true,
          actor: data?.actor ?? null,
          target: data?.target ?? null,
        });
      } catch (error) {
        if (mounted && (error as Error).name !== "AbortError") {
          setImpersonationStatus({ active: false });
        }
      }
    };

    void loadImpersonationStatus();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [pathname]);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGoHome = () => {
    router.push("/");
  };

  const handleGoProfile = () => {
    router.push("/profile");
  };

  const handleStopImpersonation = useCallback(async () => {
    if (stoppingImpersonation) return;
    setStoppingImpersonation(true);

    try {
      const response = await fetch(apiUrl("/admin/impersonation/stop"), {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to stop impersonation.");
      }

      setImpersonationStatus({ active: false });
      const redirectPath = payload?.data?.redirectPath || "/admin/dashboard";
      dispatchAuthSessionChangedEvent();
      router.replace(redirectPath);
      router.refresh();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to stop impersonation:", error);
      }
    } finally {
      setStoppingImpersonation(false);
    }
  }, [router, stoppingImpersonation]);

  const normalizedRole = normalizeRole(profileRole);
  const navItems = NAV_ITEMS_BY_ROLE[normalizedRole] ?? DEFAULT_NAV_ITEMS;

  const inferredBasePath = KNOWN_BASE_PATHS.find(
    (base) => pathname === base || pathname.startsWith(`${base}/`)
  );
  const basePath = inferredBasePath ?? ROLE_BASE_PATHS[normalizedRole] ?? "/dashboard";

  const navRoutes: Record<string, string> = {
    Dashboard: basePath,
    "Manage Users": `${basePath}/manage-users`,
    "Manage Buses": `${basePath}/manage-buses`,
    "Track Bus": `${basePath}/track-bus`,
    "Manage Bookings": `${basePath}/manage-bookings`,
    "Manage Offers": `${basePath}/manage-offers`,
    "Manage Transactions": `${basePath}/manage-transactions`,
  };

  const isRouteMatch = (route: string) =>
    pathname === route || pathname.startsWith(`${route}/`);

  const isItemPathMatch = (label: string) => {
    if (label === "Dashboard") {
      return pathname === basePath || pathname === `${basePath}/`;
    }

    const destination = navRoutes[label];
    const slugRoute = `${basePath}/${toSlug(label)}`;
    return destination ? isRouteMatch(destination) : isRouteMatch(slugRoute);
  };

  const hasRouteMatch = navItems.some((item) =>
    isItemPathMatch(item.label)
  );
  const fallbackActiveItem =
    navItems.find((item) => item.label === "Dashboard")?.label ??
    navItems[0]?.label ??
    "Dashboard";
  const effectiveActiveItem = navItems.some((item) => item.label === activeItem)
    ? activeItem
    : fallbackActiveItem;

  return (
    <aside className="relative flex h-full w-full flex-col border-r border-slate-200/80 bg-white px-4 pb-6 pt-6 text-slate-700 dark:border-white/10 dark:bg-[#0b1020] dark:text-slate-200">
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="group absolute -right-3 top-[calc(var(--navbar-height,64px)+0.75rem)] z-50 hidden h-8 w-8 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 shadow-lg transition hover:scale-105 md:flex dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-200"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
        <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-lg border border-slate-200/80 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-700 opacity-0 shadow-lg transition group-hover:opacity-100 md:block dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-200">
          {tooltipLabel}
        </span>
      </button>

      <div
        className={`flex items-center gap-3 px-2 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.35)]">
          <Bus className="h-5 w-5" />
        </div>
        {!collapsed ? (
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-800 dark:text-slate-200">
              BookMySeat
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Command Center
            </p>
          </div>
        ) : null}
      </div>

      <nav className="mt-8 flex-1 space-y-1">
        {navItems.map((item) => {
          const destination = navRoutes[item.label] ?? `${basePath}/${toSlug(item.label)}`;
          const matchesPath = isItemPathMatch(item.label);
          const isActive =
            matchesPath || (!hasRouteMatch && item.label === effectiveActiveItem);
          return (
            <button
              key={item.label}
              type="button"
              title={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                router.push(destination);
                setActiveItem(item.label);
              }}
              className={`flex w-full items-center rounded-2xl border py-2 text-sm transition hover:-translate-y-0.5 ${
                isActive
                  ? "border-slate-200 bg-slate-100 text-slate-900 dark:border-white/10 dark:bg-white/10 dark:text-white"
                  : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
              } ${
                collapsed ? "justify-center px-2" : "gap-3 px-3"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {!collapsed ? <span>{item.label}</span> : null}
            </button>
          );
        })}
      </nav>

      {impersonationStatus.active ? (
        <div
          className={`mb-3 rounded-2xl border border-indigo-200/80 bg-indigo-50 p-3 text-xs text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-100 ${
            collapsed ? "flex flex-col items-center gap-2" : "space-y-2"
          }`}
        >
          {collapsed ? null : (
            <div className="space-y-1">
              <p className="font-semibold uppercase tracking-[0.15em]">
                Impersonating
              </p>
              <p>
                {impersonationStatus.target?.fullName || "Target user"} (
                {String(impersonationStatus.target?.role || "").toUpperCase() || "ROLE"})
              </p>
              <p className="text-[11px] opacity-80">
                as {impersonationStatus.actor?.fullName || "Admin"}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleStopImpersonation()}
            disabled={stoppingImpersonation}
            title="Stop impersonation"
            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-300/90 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-400/40 dark:bg-indigo-950/40 dark:text-indigo-100 ${
              collapsed ? "w-full px-2" : "w-full"
            }`}
          >
            {stoppingImpersonation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {!collapsed ? "Stop Impersonation" : null}
          </button>
        </div>
      ) : null}

      <div
        className={`rounded-2xl border border-slate-200/80 bg-slate-100 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 ${
          collapsed ? "flex flex-col items-center gap-2" : ""
        }`}
      >
        <div
          className={`flex items-center gap-2 ${
            collapsed ? "flex-col" : "justify-between"
          }`}
        >
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title="Toggle theme"
            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 px-3 py-2 text-xs font-semibold transition dark:border-white/10 ${
              themeReady
                ? "bg-white text-slate-700 dark:bg-white/10 dark:text-white"
                : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"
            }`}
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            {!collapsed ? (isDark ? "Light" : "Dark") : null}
          </button>
          <button
            type="button"
            onClick={handleScrollTop}
            aria-label="Scroll to top"
            title="Scroll to top"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleGoProfile}
            aria-label="Open profile"
            title="Open profile"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            <User className="h-4 w-4" />
          </button>
        </div>
        {collapsed ? (
          <button
            type="button"
            onClick={handleGoHome}
            aria-label="Home page"
            title="Home Page"
            className="mt-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            <LogIn className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGoHome}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            <LogIn className="h-4 w-4" />
            Home Page
          </button>
        )}
      </div>
    </aside>
  );
};

export { Sidebar };
