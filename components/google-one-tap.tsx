"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
} from "firebase/auth";
import { usePathname } from "next/navigation";

import { apiUrl } from "@/lib/api";
import { dispatchAuthSessionChangedEvent } from "@/lib/auth-events";
import { firebaseAuth } from "@/lib/firebase/client";

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** Routes where the One Tap prompt should NOT appear (sign-in page already visible). */
const SUPPRESSED_ROUTES = ["/login"];

/**
 * GoogleOneTap — renders nothing visible but loads the Google Identity Services
 * client library and shows the One Tap prompt for unauthenticated visitors.
 *
 * Once a user selects an account the flow is:
 *   Google ID token → Firebase `signInWithCredential` → POST /firebase-auth → session cookie
 */
const GoogleOneTap = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const scriptLoadedRef = useRef(false);
  const initCalledRef = useRef(false);
  const pathname = usePathname();

  // Suppress Google One Tap FedCM warnings
  useEffect(() => {
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    console.warn = (...args) => {
      const message = args.join(" ");
      if (
        message.includes("GSI_LOGGER") ||
        message.includes("FedCM") ||
        message.includes("Google One Tap")
      ) {
        return; // Suppress these warnings
      }
      originalConsoleWarn.apply(console, args);
    };

    console.error = (...args) => {
      const message = args.join(" ");
      if (
        message.includes("GSI_LOGGER") ||
        message.includes("FedCM") ||
        message.includes("Google One Tap")
      ) {
        return; // Suppress these errors
      }
      originalConsoleError.apply(console, args);
    };

    return () => {
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    };
  }, []);

  // ── Track auth state ─────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setIsLoggedIn(!!user);
    });
    return unsubscribe;
  }, []);

  // ── Handle credential from One Tap ───────────────────────────────────
  const handleCredentialResponse = useCallback(
    async (response: GoogleCredentialResponse) => {
      try {
        // 1. Convert Google ID token → Firebase credential
        const credential = GoogleAuthProvider.credential(response.credential);
        const result = await signInWithCredential(firebaseAuth, credential);

        // 2. Exchange for session cookie via existing backend endpoint
        const idToken = await result.user.getIdToken();
        const backendResponse = await fetch(apiUrl("/firebase-auth"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            token: idToken,
            fullName: result.user.displayName || undefined,
          }),
        });

        if (!backendResponse.ok) {
          const data = await backendResponse.json().catch(() => ({}));
          console.error(
            "[GoogleOneTap] Backend auth failed:",
            data?.message || backendResponse.statusText,
          );
          return;
        }

        // 3. Broadcast session change so AppShell re-renders
        dispatchAuthSessionChangedEvent();
      } catch (error) {
        console.error("[GoogleOneTap] Sign-in failed:", error);
      }
    },
    [],
  );

  // ── Load GIS script & initialize ─────────────────────────────────────
  useEffect(() => {
    // Bail out if already logged in, no client ID, or on a suppressed route
    if (isLoggedIn === null) return; // still loading auth state
    if (isLoggedIn) return;
    if (!CLIENT_ID) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[GoogleOneTap] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set — One Tap disabled.",
        );
      }
      return;
    }
    if (SUPPRESSED_ROUTES.some((route) => pathname?.endsWith(route))) return;

    const initializeOneTap = () => {
      if (!window.google?.accounts?.id) return;
      if (initCalledRef.current) return;
      initCalledRef.current = true;

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
        itp_support: true,
        log_level: "error", // Suppress info/warning logs
      });

      window.google.accounts.id.prompt((notification) => {
        // Silently handle prompt dismissal
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // User dismissed or skipped - this is normal, don't log
        }
      });
    };

    // If the script is already loaded (e.g. hot reload), just re-init
    if (window.google?.accounts?.id) {
      initCalledRef.current = false;
      initializeOneTap();
      return;
    }

    // Avoid injecting the script twice
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = initializeOneTap;
    document.head.appendChild(script);

    return () => {
      // Cancel the prompt on unmount / route change
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        /* noop */
      }
      initCalledRef.current = false;
    };
  }, [isLoggedIn, pathname, handleCredentialResponse]);

  // ── Cancel prompt when user logs in ──────────────────────────────────
  useEffect(() => {
    if (isLoggedIn) {
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        /* noop */
      }
    }
  }, [isLoggedIn]);

  // This component renders nothing — the One Tap UI is injected by Google.
  return null;
};

export default GoogleOneTap;
