"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ConfirmationResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  User,
} from "firebase/auth";
import { Bus, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import Image from "next/image";
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

const SignCard = ({ className, onAuthSuccess }: SignCardProps) => {
  const t = useTranslations("auth");
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const perks = [
    { title: t("trustedBookings"), description: t("trustedBookingsDesc") },
    { title: t("easyCancellations"), description: t("easyCancellationsDesc") },
    { title: t("communityRating"), description: t("communityRatingDesc") },
  ];

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null,
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
      },
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

  const finishLogin = useCallback(async (user: User) => {
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
  }, []);

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
        recaptchaRef.current,
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

  // Auto-submit OTP
  useEffect(() => {
    if (otp.length === 6 && confirmation && !isVerifying) {
      handleVerifyCode();
    }
  }, [otp, confirmation, handleVerifyCode, isVerifying]);

  const handleOtpChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;

      const newOtp = otp.split("");

      // Handle paste
      if (value.length > 1) {
        const pasted = value.slice(0, 6).split("");
        for (let i = 0; i < pasted.length; i++) {
          if (i + index < 6) newOtp[i + index] = pasted[i];
        }
        setOtp(newOtp.join(""));
        const focusIndex = Math.min(index + pasted.length, 5);
        otpRefs.current[focusIndex]?.focus();
      } else {
        newOtp[index] = value;
        setOtp(newOtp.join(""));
        if (value && index < 5) {
          otpRefs.current[index + 1]?.focus();
        }
      }
    },
    [otp],
  );

  const handleOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !otp[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
      if (e.key === "Enter" && otp.length === 6) {
        handleVerifyCode();
      }
    },
    [otp, handleVerifyCode],
  );

  return (
    <div
      className={cn(
        "w-full max-w-[1040px] overflow-x-hidden overflow-y-auto rounded-3xl border bg-white shadow-2xl sm:max-h-none sm:overflow-hidden max-h-[calc(100dvh-155px)] dark:border-white/10 dark:bg-slate-950",
        className,
      )}
    >
      <div className="grid gap-0 md:grid-cols-[1.05fr_1.35fr]">
        <div className="relative hidden flex-col justify-between overflow-hidden px-6 py-8 md:flex sm:px-8 sm:py-10">
          <Image
            src="/images/auth-bg.png"
            alt="Scenic Bus Journey"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
          {/* Gradient overlay to ensure text readability */}
          <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 via-slate-900/40 to-slate-900/20" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 text-white">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-xl">
                <Bus className="h-6 w-6" />
              </span>
              <div>
                <p className="text-lg font-bold tracking-wide">BookMySeat</p>
                <p className="text-sm text-white/80 font-medium">
                  Your Journey, Our Priority
                </p>
              </div>
            </div>

            <div className="mt-12 space-y-6">
              {perks.map((perk) => (
                <div key={perk.title} className="flex gap-4 items-start">
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                  <div>
                    <p className="text-base font-semibold text-white">
                      {perk.title}
                    </p>
                    <p className="text-sm text-white/70 mt-0.5 leading-relaxed">
                      {perk.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-10 grid gap-3 rounded-2xl border border-white/20 bg-white/10 p-5 text-sm font-medium text-white shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              Secure & verified checkout
            </div>
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-sky-400" />
              Early access deals for members
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-8 sm:px-12 sm:py-12 bg-white dark:bg-slate-950">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
              Welcome Back
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              Sign in or create account
            </h2>
            <p className="text-base text-slate-500 dark:text-slate-400 mt-1">
              {t("usePhoneOrGoogle")}
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Mobile Number
              </label>
              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 shadow-sm transition-all focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-400/10 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:focus-within:border-white/30 dark:focus-within:ring-white/5">
                <span className="text-slate-400">+91</span>
                <Input
                  className="h-auto border-none bg-transparent p-0 shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder={t("enterMobileNumber")}
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isSending && phone) {
                      handleSendCode();
                    }
                  }}
                />
              </div>
            </div>

            {confirmation ? (
              <div className="space-y-4">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Enter verification code
                </label>
                <div className="flex gap-2 justify-between">
                  {[...Array(6)].map((_, index) => (
                    <Input
                      key={index}
                      ref={(el) => {
                        otpRefs.current[index] = el;
                      }}
                      className="h-12 w-12 text-center text-lg font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-sm transition-all focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-400/20 dark:focus-within:border-white/30 dark:focus-within:ring-white/10"
                      maxLength={6}
                      value={otp[index] || ""}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    />
                  ))}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row mt-4">
                  <Button
                    className="w-full"
                    onClick={handleVerifyCode}
                    disabled={isVerifying || otp.length < 6}
                  >
                    {isVerifying ? "Verifying..." : "Verify code"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setConfirmation(null);
                      setOtp("");
                    }}
                    disabled={isVerifying}
                  >
                    Change number
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full py-6 text-base font-semibold shadow-md transition-all hover:-translate-y-0.5"
                onClick={handleSendCode}
                disabled={isSending}
              >
                {isSending ? "Sending code..." : "Continue with Phone"}
              </Button>
            )}

            <div className="flex items-center gap-4 text-sm text-slate-400 dark:text-slate-500">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              Or continue with
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <Button
              variant="outline"
              className="w-full justify-center gap-2 py-6 text-base font-semibold shadow-sm transition-all hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
            >
              <Image
                src="/google.svg"
                alt="Google"
                width={20}
                height={20}
                className="shrink-0"
              />
              {isGoogleLoading ? "Connecting..." : "Sign in with Google"}
            </Button>

            <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500 shadow-inner dark:border-white/5 dark:bg-white/2 dark:text-slate-400">
              <Phone className="mt-0.5 h-5 w-5 text-slate-400 shrink-0" />
              <p className="leading-relaxed">{t("secureCodeMessage")}</p>
            </div>

            {message ? (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-xs",
                  message.type === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
                )}
              >
                {message.text}
              </div>
            ) : null}

            <p className="text-xs text-slate-400">{t("agreeTerms")}</p>
          </div>
        </div>
      </div>
      <div id="recaptcha-container" />
    </div>
  );
};

export default SignCard;
