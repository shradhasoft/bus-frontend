"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun, User as UserIcon, X } from "lucide-react";

import SignCard from "@/components/sign-card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { firebaseAuth } from "@/lib/firebase/client";

type StartViewTransition = (callback: () => void) => { ready: Promise<void> };

const ToggleTheme = ({
  className,
  duration = 400,
}: {
  className?: string;
  duration?: number;
}) => {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  const toggleTheme = useCallback(async () => {
    const startViewTransition = (
      document as Document & { startViewTransition?: StartViewTransition }
    ).startViewTransition;

    if (!buttonRef.current || !startViewTransition) {
      setTheme(isDark ? "light" : "dark");
      return;
    }

    try {
      const { left, width, top, height } =
        buttonRef.current.getBoundingClientRect();
      const x = left + width / 2;
      const y = top + height / 2;
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = startViewTransition(() => {
        setTheme(isDark ? "light" : "dark");
      });

      await transition.ready;

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        } as KeyframeAnimationOptions & { pseudoElement: string }
      );
    } catch (error) {
      console.error("View transition failed:", error);
      setTheme(isDark ? "light" : "dark");
    }
  }, [isDark, setTheme, duration]);

  if (!mounted) {
    return (
      <button
        type="button"
        className="group relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-slate-900/10 bg-black/5 text-slate-900 dark:border-white/15 dark:bg-white/10 dark:text-white/90"
        aria-label="Toggle theme"
      >
        <span className="text-[10px] font-semibold tracking-[0.28em] opacity-70">
          ...
        </span>
      </button>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleTheme}
        className={`group relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-slate-900/10 bg-black/5 text-slate-900 transition hover:bg-black/10 dark:border-white/15 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/15 ${className ?? ""}`}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      >
        {isDark ? (
          <Sun className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
        ) : (
          <Moon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
        )}

        <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="absolute -left-6 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full bg-black/10 blur-xl dark:bg-white/10" />
        </span>
      </button>

      <style jsx>{`
        ::view-transition-old(root),
        ::view-transition-new(root) {
          animation: none;
          mix-blend-mode: normal;
        }
      `}</style>
    </>
  );
};

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollingUp, setScrollingUp] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const lastScrollY = useRef(0);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      setScrolled(current > 10);
      setScrollingUp(current < lastScrollY.current && current > 10);
      lastScrollY.current = current;
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
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

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
    [pathname, router]
  );

  const openAuth = useCallback(() => {
    setOpen(false);
    setAuthOpen(true);
  }, []);

  const goProfile = useCallback(() => {
    setOpen(false);
    router.push("/profile");
  }, [router]);

  return (
    <header className="fixed inset-x-0 top-0 z-[999]">
      <div
        className="mx-auto w-full px-3 transition-[padding] duration-300 sm:px-6"
      >
        <div
          className={[
            "relative transform-gpu transition-all duration-300 ease-out",
            "mt-3 rounded-2xl",
            scrolled
              ? [
                  "translate-y-0 border backdrop-blur-xl",
                  "border-slate-900/10 bg-white/70 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)]",
                  "dark:border-white/15 dark:bg-black/40 dark:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.65)]",
                ].join(" ")
              : [
                  "translate-y-1 border-transparent bg-transparent shadow-none backdrop-blur-0",
                  "dark:border-transparent dark:bg-transparent",
                ].join(" "),
          ].join(" ")}
        >
          <div
            className={[
              "pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-black/5 blur-2xl transition-opacity duration-300 dark:bg-white/10",
              scrolled ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
          <div
            className={[
              "pointer-events-none absolute -right-10 -bottom-10 h-28 w-28 rounded-full bg-black/5 blur-2xl transition-opacity duration-300 dark:bg-white/10",
              scrolled ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />

          <div className="relative flex items-center justify-between px-4 py-3 sm:px-6">
            <div
              className={[
                "z-20 flex items-center gap-3 transition-transform duration-300 ease-out",
                scrolled ? "translate-x-2" : "translate-x-0",
              ].join(" ")}
            >
              <ToggleTheme />

              <Link
                href="/"
                className="group rounded-xl px-2 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
                aria-label="Home"
                onClick={() => setOpen(false)}
              >
                <p className="text-sm font-semibold text-slate-900/90 dark:text-white/90">
                  BookMySeat
                </p>
                <p className="text-xs text-slate-600 dark:text-white/60">
                  {/* Tagline can go here if needed */}
                  Your Journey, Our Priority
                </p>
              </Link>
            </div>

            <div
              className={[
                "pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 sm:block",
                "transition-transform duration-300 ease-out",
                scrolled ? "scale-95" : "scale-100",
              ].join(" ")}
            >
              <nav className="pointer-events-auto flex items-center gap-2">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={handleNavClick(l.href)}
                    className="rounded-full px-4 py-2 text-sm text-slate-600 transition hover:bg-black/5 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div
              className={[
                "z-20 flex items-center gap-2 transition-transform duration-300 ease-out",
                scrolled ? "-translate-x-2" : "translate-x-0",
              ].join(" ")}
            >
              {currentUser ? (
                <button
                  type="button"
                  onClick={goProfile}
                  className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-900/10 bg-white/70 text-slate-700 transition hover:border-slate-900/20 hover:text-slate-900 dark:border-white/15 dark:bg-white/10 dark:text-white/80 dark:hover:border-white/25 dark:hover:text-white sm:inline-flex"
                  aria-label="Profile"
                >
                  <UserIcon className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openAuth}
                  className="hidden items-center text-sm font-semibold text-slate-700 transition hover:text-slate-900 dark:text-white/80 dark:hover:text-white sm:inline-flex"
                >
                  Login/SignUp
                </button>
              )}

              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-900/10 bg-white/70 text-slate-900 backdrop-blur transition hover:bg-white/85 dark:border-white/15 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/15 sm:hidden"
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={[
          "sm:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
      >
        <div
          className={[
            "fixed inset-0 backdrop-blur-sm transition-opacity",
            open ? "opacity-100" : "opacity-0",
            "bg-slate-900/35 dark:bg-black/60",
          ].join(" ")}
          onClick={() => setOpen(false)}
        />

        <div
          className={[
            "fixed left-1/2 top-[76px] w-[calc(100%-24px)] -translate-x-1/2",
            "rounded-2xl border backdrop-blur-xl",
            "shadow-[0_18px_50px_-20px_rgba(0,0,0,0.35)] dark:shadow-[0_18px_50px_-20px_rgba(0,0,0,0.75)]",
            "transition-all duration-200",
            "border-slate-900/10 bg-white/75 dark:border-white/15 dark:bg-black/50",
            open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
          ].join(" ")}
        >
          <div className="p-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={handleNavClick(l.href)}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-sm text-slate-800/90 transition hover:bg-black/5 dark:text-white/85 dark:hover:bg-white/5"
              >
                <span>{l.label}</span>
              </Link>
            ))}

            {currentUser ? (
              <button
                type="button"
                onClick={goProfile}
                className="mt-2 flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-slate-800/90 transition hover:bg-black/5 dark:text-white/85 dark:hover:bg-white/5"
              >
                <span className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  Profile
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openAuth}
                className="mt-2 flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-slate-800/90 transition hover:bg-black/5 dark:text-white/85 dark:hover:bg-white/5"
              >
                <span>Login/SignUp</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="border-0 bg-transparent p-0 shadow-none">
          <SignCard />
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Navbar;
