"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Bus, Menu, Moon, Sun, User as UserIcon, X } from "lucide-react";

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
    { label: "Track Bus", href: "/track" },
    {
      label: "Rent Bus",
      href: "/rent",
    },
    { label: "Offers", href: "/offers" },

    { label: "Help", href: "/help" },
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
    <header className="fixed top-4 left-1/2 z-[999] w-full -translate-x-1/2 px-4">
      <nav
        className={`transition-all duration-500 custom-expo ${
          scrolled
            ? "w-[95%] max-w-6xl nav-glass shadow-card rounded-full py-3 px-6"
            : "w-full max-w-7xl py-4 px-6 bg-transparent"
        } mx-auto`}
      >
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 group"
            aria-label="Home"
            onClick={() => setOpen(false)}
          >
            <div className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Bus className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900/90 transition-colors duration-300 dark:text-white/90">
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

          <div className="flex items-center gap-3">
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
                      My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-white/85"
                      onSelect={toggleTheme}
                    >
                      {themeReady ? (
                        isDark ? (
                          <>
                            <Sun className="h-4 w-4" />
                            Light mode
                          </>
                        ) : (
                          <>
                            <Moon className="h-4 w-4" />
                            Dark mode
                          </>
                        )
                      ) : (
                        <>
                          <Moon className="h-4 w-4" />
                          Theme
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem
                      className="rounded-lg px-3 py-2 text-sm text-rose-600 focus:text-rose-600 dark:text-rose-300"
                      disabled={isLoggingOut}
                      onSelect={handleLogout}
                    >
                      {isLoggingOut ? "Logging out..." : "Log out"}
                    </DropdownMenuItem>
                    {roleSwitchPath ? (
                      <DropdownMenuItem
                        className="rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-white/85"
                        onSelect={handleRoleSwitch}
                      >
                        Switch to {profileRole}
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
                Login/SignUp
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

        <div
          className={`md:hidden absolute top-full left-0 right-0 mt-2 nav-glass rounded-2xl overflow-hidden transition-all duration-300 custom-expo ${
            open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
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
                  My Profile
                </button>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="block w-full py-2 text-left text-slate-800/90 font-medium transition-colors hover:text-slate-900 dark:text-white/85 dark:hover:text-white"
                >
                  {themeReady ? (isDark ? "Light mode" : "Dark mode") : "Theme"}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="block w-full py-2 text-left text-rose-600 font-medium disabled:opacity-60"
                >
                  {isLoggingOut ? "Logging out..." : "Log out"}
                </button>
                {roleSwitchPath ? (
                  <button
                    type="button"
                    onClick={handleRoleSwitch}
                    className="block w-full py-2 text-left text-slate-800/90 font-medium transition-colors hover:text-slate-900 dark:text-white/85 dark:hover:text-white"
                  >
                    Switch to {profileRole}
                  </button>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={openAuth}
                className="block w-full py-2 text-left text-slate-800/90 font-medium transition-colors hover:text-slate-900 dark:text-white/85 dark:hover:text-white"
              >
                Login/SignUp
              </button>
            )}
          </div>
        </div>
      </nav>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="border-0 bg-transparent p-0 shadow-none sm:max-w-[1040px]">
          <SignCard onAuthSuccess={handleAuthSuccess} />
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Navbar;
