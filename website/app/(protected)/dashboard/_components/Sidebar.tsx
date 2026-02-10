"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Banknote,
  Bus,
  ArrowUp,
  CalendarCheck2,
  ChartNoAxesCombined,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  FileText,
  LogIn,
  MessageSquareText,
  Moon,
  Sun,
  User,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";

const navItems = [
  { label: "Overview", icon: Activity },
  { label: "Trips", icon: Bus },
  { label: "Bookings", icon: ClipboardList },
  { label: "Crew & Staff", icon: Users },
  { label: "Compliance", icon: BadgeCheck },
  { label: "Reports", icon: FileText },
  { label: "Schedule", icon: CalendarCheck2 },
  { label: "Finance", icon: Banknote },
  { label: "Insights", icon: ChartNoAxesCombined },
  { label: "Broadcast", icon: MessageSquareText },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const tooltipLabel = collapsed
    ? "Expand (⌘/Ctrl + B)"
    : "Collapse (⌘/Ctrl + B)";
  const { setTheme, resolvedTheme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);
  const isDark = resolvedTheme === "dark";
  const router = useRouter();

  useEffect(() => {
    setThemeReady(true);
  }, []);

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
        {navItems.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.label}
            className={`flex w-full items-center rounded-2xl border border-transparent py-2 text-sm text-slate-600 transition hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white ${
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {!collapsed ? <span>{item.label}</span> : null}
          </button>
        ))}
      </nav>

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
