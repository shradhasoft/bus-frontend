"use client";

import type { CSSProperties, ReactNode } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "./dashboard/_components/navbar";
import { Sidebar } from "./dashboard/_components/Sidebar";

const SIDEBAR_WIDTH = "17rem";
const SIDEBAR_COLLAPSED_WIDTH = "4.75rem";
const STANDALONE_ROUTES = ["/profile"];

const isStandaloneRoute = (pathname: string) =>
  STANDALONE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

const ProtectedShell = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

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

  const shellStyle = useMemo(
    () =>
      ({
        "--navbar-height": "64px",
        "--sidebar-width": collapsed
          ? SIDEBAR_COLLAPSED_WIDTH
          : SIDEBAR_WIDTH,
      }) as CSSProperties,
    [collapsed]
  );

  if (isStandaloneRoute(pathname)) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 pb-8 pt-24 text-slate-900 dark:bg-[#0b1020] dark:text-slate-100 sm:px-6 lg:px-8">
        {children}
      </main>
    );
  }

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0b1020] dark:text-slate-100"
      style={shellStyle}
    >
      <div className="fixed inset-x-0 top-0 z-50 h-[var(--navbar-height,64px)] md:pl-[var(--sidebar-width,17rem)]">
        <Navbar />
      </div>

      <div
        className="fixed inset-y-0 z-40 hidden transition-[width] duration-300 md:flex"
        style={{ width: "var(--sidebar-width,17rem)" }}
      >
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      </div>

      <main className="min-h-screen pt-[var(--navbar-height,64px)] transition-[padding] duration-300 md:pl-[var(--sidebar-width,17rem)]">
        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
};

export default ProtectedShell;
