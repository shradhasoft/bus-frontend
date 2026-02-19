"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConfirmationResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  User,
} from "firebase/auth";
import { Bus, Chrome, Phone, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/api";
import { dispatchAuthSessionChangedEvent } from "@/lib/auth-events";
import { firebaseAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

type SignCardProps = {
  className?: string;
  onAuthSuccess?: () => void;
};

const perks = [
  {
    title: "Trusted bookings",
    description: "Seats verified across top-rated bus operators.",
  },
  {
    title: "Easy cancellations",
    description: "Flexible refunds and fast resolution support.",
  },
  {
    title: "4.8★ community rating",
    description: "Loved by thousands of happy travelers.",
  },
];

const SignCard = ({ className, onAuthSuccess }: SignCardProps) => {
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null
  );
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (recaptchaRef.current || typeof window === "undefined") return;
    recaptchaRef.current = new RecaptchaVerifier(
      firebaseAuth,
      "recaptcha-container",
      {
        size: "invisible",
      }
    );

    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  const normalizedPhone = useMemo(() => {
    const trimmed = phone.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("+")) {
      return trimmed.replace(/[^\d+]/g, "");
    }
    const digits = trimmed.replace(/\D/g, "");
    return digits ? `+91${digits}` : "";
  }, [phone]);

  const finishLogin = useCallback(
    async (user: User) => {
      const token = await user.getIdToken();
      const response = await fetch(apiUrl("/firebase-auth"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          fullName: user.displayName || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Authentication failed");
      }

      dispatchAuthSessionChangedEvent();
    },
    []
  );

  const handleSendCode = useCallback(async () => {
    setMessage(null);

    if (!normalizedPhone) {
      setMessage({ type: "error", text: "Enter a valid phone number." });
      return;
    }

    if (!recaptchaRef.current) {
      setMessage({ type: "error", text: "reCAPTCHA is not ready yet." });
      return;
    }

    setIsSending(true);
    try {
      const result = await signInWithPhoneNumber(
        firebaseAuth,
        normalizedPhone,
        recaptchaRef.current
      );
      setConfirmation(result);
      setOtp("");
      setMessage({ type: "success", text: "Code sent. Check your phone." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to send code.",
      });
    } finally {
      setIsSending(false);
    }
  }, [normalizedPhone]);

  const handleVerifyCode = useCallback(async () => {
    if (!confirmation) return;
    if (!otp.trim()) {
      setMessage({ type: "error", text: "Enter the verification code." });
      return;
    }

    setIsVerifying(true);
    setMessage(null);
    try {
      const credential = await confirmation.confirm(otp.trim());
      await finishLogin(credential.user);
      setMessage({ type: "success", text: "You're signed in." });
      onAuthSuccess?.();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Verification failed.",
      });
    } finally {
      setIsVerifying(false);
    }
  }, [confirmation, finishLogin, otp, onAuthSuccess]);

  const handleGoogleSignIn = useCallback(async () => {
    setIsGoogleLoading(true);
    setMessage(null);
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(firebaseAuth, provider);
      await finishLogin(credential.user);
      setMessage({ type: "success", text: "You're signed in." });
      onAuthSuccess?.();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Google sign-in failed.",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  }, [finishLogin, onAuthSuccess]);

  return (
    <div
      className={cn(
        "w-full max-w-[1040px] overflow-x-hidden overflow-y-auto rounded-3xl border bg-white shadow-2xl sm:max-h-none sm:overflow-hidden max-h-[calc(100dvh-155px)] dark:border-white/10 dark:bg-slate-950",
        className
      )}
    >
      <div className="grid gap-0 md:grid-cols-[1.05fr_1.35fr]">
        <div className="relative flex flex-col justify-between overflow-hidden bg-slate-50 px-6 py-8 dark:bg-slate-900/60 sm:px-8 sm:py-10">
          <div className="absolute -left-24 -top-24 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-3 text-slate-700 dark:text-slate-200">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900">
                <Bus className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">BookMySeat</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your Journey, Our Priority
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-5">
              {perks.map((perk) => (
                <div key={perk.title} className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500/90" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                      {perk.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {perk.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-10 grid gap-3 rounded-2xl border border-white/60 bg-white/70 p-5 text-xs text-slate-500 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Secure & verified checkout
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-500" />
              Early access deals for members
            </div>
          </div>
        </div>

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Account
            </p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Sign in or create an account
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Use your phone number or Google to continue.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="text-xs font-medium text-slate-500">
                Mobile Number
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus-within:border-slate-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:focus-within:border-white/30">
                <span className="text-slate-400">+91</span>
                <Input
                  className="h-auto border-0 p-0 shadow-none focus-visible:ring-0"
                  placeholder="Enter mobile number"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            </div>

            {confirmation ? (
              <div className="space-y-3">
                <Input
                  placeholder="Enter verification code"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="w-full"
                    onClick={handleVerifyCode}
                    disabled={isVerifying}
                  >
                    {isVerifying ? "Verifying..." : "Verify code"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setConfirmation(null)}
                    disabled={isVerifying}
                  >
                    Change number
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={handleSendCode}
                disabled={isSending}
              >
                {isSending ? "Sending code..." : "Continue with Phone"}
              </Button>
            )}

            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              Or continue with
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
            >
              <Chrome className="h-4 w-4" />
              {isGoogleLoading ? "Connecting..." : "Sign in with Google"}
            </Button>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
              <Phone className="mt-0.5 h-4 w-4 text-slate-400" />
              We will send you a one-time code to verify your number.
            </div>

            {message ? (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-xs",
                  message.type === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                )}
              >
                {message.text}
              </div>
            ) : null}

            <p className="text-xs text-slate-400">
              By continuing, you agree to our terms of use and privacy policy.
            </p>
          </div>
        </div>
      </div>
      <div id="recaptcha-container" />
    </div>
  );
};

export default SignCard;
