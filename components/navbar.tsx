"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Bus, Menu, Moon, Sun, User as UserIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

import SignCard from "@/components/sign-card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  VisuallyHidden,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiUrl } from "@/lib/api";
import { dispatchAuthSessionChangedEvent } from "@/lib/auth-events";
import { firebaseAuth } from "@/lib/firebase/client";
import { NotificationBell } from "@/components/notification-bell";
import LanguageSwitcher from "@/components/language-switcher";

const ROLE_SWITCH_TARGETS: Record<string, string> = {
  admin: "/admin/dashboard",
  owner: "/bus-owner/dashboard",
  superadmin: "/super-admin/dashboard",
  conductor: "/conductor/dashboard",
};

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [roleRefreshKey, setRoleRefreshKey] = useState(0);
  const [mounted, setMounted] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const t = useTranslations("nav");
  const tc = useTranslations("common");

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      setScrolled(current > 10);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setProfileRole(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const loadRole = async () => {
      try {
        let idToken: string | null = null;
        try {
          idToken = await currentUser.getIdToken();
        } catch (tokenError) {
          if (process.env.NODE_ENV === "development") {
            console.warn("Failed to get ID token for role fetch", tokenError);
          }
        }

        const response = await fetch(apiUrl("/profile/role"), {
          method: "GET",
          credentials: "include",
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
          cache: "no-store",
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
  }, [currentUser, roleRefreshKey]);

  const links = [
    { label: t("trackBus"), href: "/track" },
    { label: t("rentBus"), href: "/rent" },
    { label: t("offers"), href: "/offers" },
    { label: t("help"), href: "/help" },
  ];

  const isActive = (href: string) => {
    // next/navigation usePathname returns raw path including locale prefix
    // Strip locale prefix only when followed by / or end-of-string
    // e.g. /en/offers → /offers, /hi/track → /track, /offers → /offers
    const stripped = pathname.replace(/^\/[a-z]{2}(-[A-Z]{2})?(\/|$)/, "/");
    return stripped === href || stripped.startsWith(`${href}/`);
  };

  const handleNavClick = useCallback(
    (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (href.startsWith("http")) {
        setOpen(false);
        return;
      }

      if (href.startsWith("#")) {
        e.preventDefault();
        setOpen(false);

        const id = href.slice(1);

        const go = () => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        };

        if (pathname === "/") {
          requestAnimationFrame(go);
        } else {
          router.push(`/${href}`);
          setTimeout(go, 60);
        }
        return;
      }

      setOpen(false);
    },
    [pathname, router],
  );

  const openAuth = useCallback(() => {
    setOpen(false);
    setAuthOpen(true);
  }, []);

  const handleAuthSuccess = useCallback(() => {
    setAuthOpen(false);
    setRoleRefreshKey((value) => value + 1);
  }, []);

  const goProfile = useCallback(() => {
    setOpen(false);
    router.push("/profile");
  }, [router]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setOpen(false);
    setAuthOpen(false);

    try {
      try {
        const response = await fetch(apiUrl("/logout"), {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.error(
            "Logout failed:",
            data?.message || response.statusText || response.status,
          );
        }
      } catch (error) {
        console.error("Logout failed:", error);
      }

      try {
        await signOut(firebaseAuth);
      } catch (error) {
        console.error("Firebase sign out failed:", error);
      }

      setCurrentUser(null);
      setProfileRole(null);
      dispatchAuthSessionChangedEvent();
      router.replace("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, router]);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  const roleSwitchPath = profileRole ? ROLE_SWITCH_TARGETS[profileRole] : null;

  const handleRoleSwitch = useCallback(() => {
    if (!roleSwitchPath) return;
    setOpen(false);
    router.push(roleSwitchPath);
  }, [roleSwitchPath, router]);

  return (
    <header className="fixed top-4 left-1/2 z-[999] w-full -translate-x-1/2 px-2 sm:px-4">
      <nav
        className={`transition-all duration-500 custom-expo ${
          scrolled
            ? "w-[95%] max-w-6xl nav-glass shadow-card rounded-full py-3 px-3 sm:px-6"
            : "w-full max-w-7xl py-4 px-3 sm:px-6 bg-transparent"
        } mx-auto relative`}
      >
        <div className="flex items-center justify-between min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 group shrink-0"
            aria-label="Home"
            onClick={() => setOpen(false)}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-rose-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Bus className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900/90 transition-colors duration-300 dark:text-white/90">
              BookMySeat
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={handleNavClick(l.href)}
                  className={`text-sm font-medium relative group transition-all duration-300 ${
                    active
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-600 hover:text-slate-900 hover:opacity-70 dark:text-white/70 dark:hover:text-white"
                  }`}
                >
                  {l.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-0.5 bg-rose-500 transition-all duration-300 ${
                      active ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <LanguageSwitcher />
            {currentUser ? (
              <>
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-2 rounded-full text-slate-700 transition-all duration-300 hover:bg-white/10 hover:text-slate-900 dark:text-white/80 dark:hover:text-white"
                      aria-label="Profile"
                    >
                      <UserIcon className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    side="bottom"
                    sideOffset={12}
                    className="min-w-[180px] rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/95"
                  >
                    <DropdownMenuItem
                      className="rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-white/85"
                      onSelect={goProfile}
                    >
                      {tc("profile")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-white/85"
                      onSelect={toggleTheme}
                    >
                      {mounted ? (
                        isDark ? (
                          <>
                            <Sun className="h-4 w-4" />
                            {tc("lightMode")}
                          </>
                        ) : (
                          <>
                            <Moon className="h-4 w-4" />
                            {tc("darkMode")}
                          </>
                        )
                      ) : (
                        <>
                          <Moon className="h-4 w-4" />
                          {tc("theme")}
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem
                      className="rounded-lg px-3 py-2 text-sm text-rose-600 focus:text-rose-600 dark:text-rose-300"
                      disabled={isLoggingOut}
                      onSelect={handleLogout}
                    >
                      {isLoggingOut ? tc("loggingOut") : tc("logout")}
                    </DropdownMenuItem>
                    {roleSwitchPath ? (
                      <DropdownMenuItem
                        className="rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-white/85"
                        onSelect={handleRoleSwitch}
                      >
                        {tc("switchTo", { role: profileRole ?? "" })}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <button
                type="button"
                onClick={openAuth}
                className="text-sm font-semibold text-slate-700 transition-all duration-300 hover:opacity-70 hover:text-slate-900 dark:text-white/80 dark:hover:text-white"
              >
                {tc("login")}
              </button>
            )}

            <button
              type="button"
              className="md:hidden p-2 rounded-full text-slate-700 transition-all duration-300 hover:bg-white/10 hover:text-slate-900 dark:text-white/80 dark:hover:text-white"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile dropdown — outside nav to avoid being clipped by rounded-full */}
      <div
        className={`md:hidden mt-2 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden transition-all duration-300 custom-expo mx-auto shadow-lg border border-slate-200 dark:border-slate-800 ${
          scrolled ? "w-[95%] max-w-6xl" : "w-full max-w-7xl"
        } ${open ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}
      >
        <div className="py-4 px-6 space-y-2">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={handleNavClick(l.href)}
                className={`flex items-center gap-2 py-2.5 px-3 rounded-xl font-medium transition-colors ${
                  active
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                    : "text-slate-900 hover:text-rose-600 dark:text-white dark:hover:text-rose-400"
                }`}
              >
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                )}
                {l.label}
              </Link>
            );
          })}
          {currentUser ? (
            <>
              <button
                type="button"
                onClick={goProfile}
                className="block w-full py-2 text-left text-slate-900 font-medium transition-colors hover:text-rose-600 dark:text-white dark:hover:text-rose-400"
              >
                {tc("profile")}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="block w-full py-2 text-left text-slate-900 font-medium transition-colors hover:text-rose-600 dark:text-white dark:hover:text-rose-400"
              >
                {mounted
                  ? isDark
                    ? tc("lightMode")
                    : tc("darkMode")
                  : tc("theme")}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="block w-full py-2 text-left text-rose-600 font-medium disabled:opacity-60 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
              >
                {isLoggingOut ? tc("loggingOut") : tc("logout")}
              </button>
              {roleSwitchPath ? (
                <button
                  type="button"
                  onClick={handleRoleSwitch}
                  className="block w-full py-2 text-left text-slate-900 font-medium transition-colors hover:text-rose-600 dark:text-white dark:hover:text-rose-400"
                >
                  {tc("switchTo", { role: profileRole ?? "" })}
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={openAuth}
              className="block w-full py-2 text-left text-slate-900 font-medium transition-colors hover:text-rose-600 dark:text-white dark:hover:text-rose-400"
            >
              {tc("login")}
            </button>
          )}
        </div>
      </div>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent
          className="border-0 bg-transparent p-0 shadow-none sm:max-w-[1040px]"
          aria-describedby="auth-dialog-description"
        >
          <VisuallyHidden>
            <DialogTitle>{tc("login")}</DialogTitle>
          </VisuallyHidden>
          <span id="auth-dialog-description" className="sr-only">
            Sign in or sign up to BookMySeat
          </span>
          <SignCard onAuthSuccess={handleAuthSuccess} />
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Navbar;
