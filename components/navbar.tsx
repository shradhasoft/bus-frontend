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
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  const [themeReady, setThemeReady] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [roleRefreshKey, setRoleRefreshKey] = useState(0);

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
    setThemeReady(true);
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
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={handleNavClick(l.href)}
                className="text-sm font-medium text-slate-600 transition-all duration-300 hover:opacity-70 hover:text-slate-900 relative group dark:text-white/70 dark:hover:text-white"
              >
                {l.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-current transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
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
                      {themeReady ? (
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
        className={`md:hidden mt-2 nav-glass rounded-2xl overflow-hidden transition-all duration-300 custom-expo mx-auto ${
          scrolled ? "w-[95%] max-w-6xl" : "w-full max-w-7xl"
        } ${open ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}
      >
        <div className="py-4 px-6 space-y-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={handleNavClick(l.href)}
              className="block py-2 text-slate-800/90 font-medium transition-colors hover:text-slate-900 dark:text-white/85 dark:hover:text-white"
            >
              {l.label}
            </Link>
          ))}
          {currentUser ? (
            <>
              <button
                type="button"
                onClick={goProfile}
                className="block w-full py-2 text-left text-slate-800/90 font-medium transition-colors hover:text-slate-900 dark:text-white/85 dark:hover:text-white"
              >
                {tc("profile")}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="block w-full py-2 text-left text-slate-800/90 font-medium transition-colors hover:text-slate-900 dark:text-white/85 dark:hover:text-white"
              >
                {themeReady
                  ? isDark
                    ? tc("lightMode")
                    : tc("darkMode")
                  : tc("theme")}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="block w-full py-2 text-left text-rose-600 font-medium disabled:opacity-60"
              >
                {isLoggingOut ? tc("loggingOut") : tc("logout")}
              </button>
              {roleSwitchPath ? (
                <button
                  type="button"
                  onClick={handleRoleSwitch}
                  className="block w-full py-2 text-left text-slate-800/90 font-medium transition-colors hover:text-slate-900 dark:text-white/85 dark:hover:text-white"
                >
                  {tc("switchTo", { role: profileRole ?? "" })}
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={openAuth}
              className="block w-full py-2 text-left text-slate-800/90 font-medium transition-colors hover:text-slate-900 dark:text-white/85 dark:hover:text-white"
            >
              {tc("login")}
            </button>
          )}
        </div>
      </div>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="border-0 bg-transparent p-0 shadow-none sm:max-w-[1040px]">
          <SignCard onAuthSuccess={handleAuthSuccess} />
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Navbar;
