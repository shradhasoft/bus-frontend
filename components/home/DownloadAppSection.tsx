"use client";

import React from "react";
import { useTranslations } from 'next-intl';
import {
  Smartphone,
  Zap,
  MapPin,
  BadgePercent,
  Bell,
  Check,
} from "lucide-react";

export default function DownloadAppSection() {
  const t = useTranslations("downloadApp");

  const FEATURES = [
    { icon: Zap, text: t("instantBooking") },
    { icon: MapPin, text: t("liveTracking") },
    { icon: BadgePercent, text: t("exclusiveDeals") },
    { icon: Bell, text: t("smartAlerts") },
  ];

  return (
  <section className="bg-slate-50 dark:bg-[#0b1020]">
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl sm:p-12 lg:p-16 dark:from-slate-800/80 dark:to-slate-800/80">
        {/* Decorative elements */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 top-1/2 h-40 w-40 rounded-full bg-rose-500/5 blur-2xl" />

        <div className="relative flex flex-col items-center gap-10 lg:flex-row lg:justify-between">
          {/* Left content */}
          <div className="max-w-lg text-center lg:text-left">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-rose-300 backdrop-blur-sm">
              <Smartphone className="h-3 w-3" />
              Mobile App
            </div>

            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              {t('journeyStarts')}
              <span className="bg-gradient-to-r from-rose-500 to-pink-400 bg-clip-text text-transparent">
                {" "}
                {t('yourPocket')}
              </span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300/80">
              Download the BookMySeat app and enjoy the fastest way to search,
              book, and track buses. Available for free on iOS and Android.
            </p>

            {/* Feature bullets */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.text}
                    className="flex items-center gap-2.5 text-sm text-white/80"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <Icon className="h-3.5 w-3.5 text-rose-500" />
                    </div>
                    {f.text}
                  </div>
                );
              })}
            </div>

            {/* Store buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {/* Apple */}
              <a
                href="#"
                className="group flex h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 transition-all duration-300 hover:border-white/20 hover:bg-white/10 active:scale-95"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-7 w-7 shrink-0 text-white"
                  fill="currentColor"
                >
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div>
                  <p className="text-[10px] font-medium leading-none text-white/50">
                    Download on the
                  </p>
                  <p className="mt-0.5 text-sm font-bold leading-none text-white">
                    App Store
                  </p>
                </div>
              </a>

              {/* Google */}
              <a
                href="#"
                className="group flex h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 transition-all duration-300 hover:border-white/20 hover:bg-white/10 active:scale-95"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6 shrink-0 text-white"
                  fill="currentColor"
                >
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 0 1 0 1.38l-2.302 2.302L15.12 12l2.578-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z" />
                </svg>
                <div>
                  <p className="text-[10px] font-medium leading-none text-white/50">
                    Get it on
                  </p>
                  <p className="mt-0.5 text-sm font-bold leading-none text-white">
                    Google Play
                  </p>
                </div>
              </a>
            </div>
          </div>

          {/* Right — phone mockup placeholder */}
          <div className="hidden lg:block">
            <div className="relative flex h-[340px] w-[180px] items-center justify-center rounded-[2rem] border-2 border-white/10 bg-gradient-to-b from-white/5 to-transparent p-1 shadow-2xl">
              <div className="flex h-full w-full flex-col items-center justify-center rounded-[1.7rem] bg-black text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/30">
                  <Smartphone className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-bold text-white">BookMySeat</p>
                <p className="mt-1 text-[10px] text-white/40">{t('comingSoon')}</p>
                <div className="mt-4 flex flex-col gap-1.5">
                  {["Book", "Track", "Save"].map((t) => (
                    <div
                      key={t}
                      className="flex items-center gap-1.5 text-[10px] text-white/50"
                    >
                      <Check className="h-3 w-3 text-emerald-400" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
}
