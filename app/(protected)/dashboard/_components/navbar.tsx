"use client";

import React, { useEffect, useState } from "react";
import { Bell, ChevronDown, Search, User } from "lucide-react";
import { apiUrl } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  owner: "Owner",
  superadmin: "Super Admin",
  conductor: "Conductor",
  user: "User",
};

type ImpersonationStatus = {
  active: boolean;
  actor?: {
    fullName?: string | null;
    role?: string | null;
  } | null;
  target?: {
    fullName?: string | null;
    role?: string | null;
  } | null;
};

const Navbar = () => {
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [impersonationStatus, setImpersonationStatus] = useState<ImpersonationStatus>({
    active: false,
  });

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
    let active = true;
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
          if (active) {
            setImpersonationStatus({ active: false });
          }
          return;
        }

        const payload = await response.json().catch(() => ({}));
        const data = payload?.data ?? {};
        if (!active) return;

        setImpersonationStatus({
          active: data?.active === true,
          actor: data?.actor ?? null,
          target: data?.target ?? null,
        });
      } catch (error) {
        if (active && (error as Error).name !== "AbortError") {
          setImpersonationStatus({ active: false });
        }
      }
    };

    void loadImpersonationStatus();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const roleLabel = profileRole
    ? ROLE_LABELS[profileRole] ?? profileRole
    : "Control Room";

  const actorRole = String(impersonationStatus.actor?.role || "").toLowerCase();
  const targetRole = String(impersonationStatus.target?.role || "").toLowerCase();
  const actorRoleLabel =
    ROLE_LABELS[actorRole] || impersonationStatus.actor?.role || "Admin";
  const targetRoleLabel =
    ROLE_LABELS[targetRole] || impersonationStatus.target?.role || "User";
  const actorName = impersonationStatus.actor?.fullName || "Admin";
  const targetName = impersonationStatus.target?.fullName || "Target user";

  return (
    <div className="flex h-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 text-slate-700 backdrop-blur dark:border-white/10 dark:bg-[#0b1020]/90 dark:text-slate-200">
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-100 px-3 py-2 text-xs text-slate-600 md:flex dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <Search className="h-4 w-4" />
          <span>Search trips, routes, tickets...</span>
        </div>
        <button
          type="button"
          className="rounded-xl border border-slate-200/80 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 md:hidden dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
        >
          Search
        </button>
        {impersonationStatus.active ? (
          <div className="hidden items-center gap-2 rounded-2xl border border-indigo-200/80 bg-indigo-50 px-3 py-2 text-[11px] font-semibold text-indigo-700 lg:flex dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-100">
            <span className="uppercase tracking-[0.12em]">Impersonating</span>
            <span>
              {targetName} ({targetRoleLabel}) as {actorName} ({actorRoleLabel})
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative rounded-2xl border border-slate-200/80 bg-slate-100 p-2 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
        </button>
        <button
          type="button"
          className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
        >
          <User className="h-4 w-4" />
          {roleLabel}
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-400" />
        </button>
      </div>
    </div>
  );
};

export { Navbar };
