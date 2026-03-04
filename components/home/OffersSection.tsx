"use client";

import React, { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { BadgePercent, Copy, Check, Sparkles, ArrowRight } from "lucide-react";
import { apiUrl } from "@/lib/api";

type OfferCard = {
  title: string;
  subtitle: string;
  code: string;
  tone: string;
  iconBg: string;
  border: string;
  glow: string;
};

const TONES = [
  {
    tone: "bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-500/10 dark:to-pink-500/10",
    iconBg: "bg-gradient-to-br from-rose-500 to-pink-500",
    border: "border-rose-200/60 dark:border-rose-500/20",
    glow: "group-hover:shadow-rose-200/40 dark:group-hover:shadow-rose-500/10",
  },
  {
    tone: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500",
    border: "border-amber-200/60 dark:border-amber-500/20",
    glow: "group-hover:shadow-amber-200/40 dark:group-hover:shadow-amber-500/10",
  },
  {
    tone: "bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-500/10 dark:to-blue-500/10",
    iconBg: "bg-gradient-to-br from-sky-500 to-blue-500",
    border: "border-sky-200/60 dark:border-sky-500/20",
    glow: "group-hover:shadow-sky-200/40 dark:group-hover:shadow-sky-500/10",
  },
  {
    tone: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500",
    border: "border-emerald-200/60 dark:border-emerald-500/20",
    glow: "group-hover:shadow-emerald-200/40 dark:group-hover:shadow-emerald-500/10",
  },
];

const FALLBACK: OfferCard[] = [
  {
    title: "Get 15% off",
    subtitle: "on your 1st booking",
    code: "BMSFIRST",
    ...TONES[0],
  },
  {
    title: "Flat ₹80 off",
    subtitle: "on Bus Booking",
    code: "BMS8OFF",
    ...TONES[1],
  },
  {
    title: "Save up to ₹200",
    subtitle: "on cards & wallets",
    code: "SAVE20",
    ...TONES[2],
  },
  {
    title: "Up to ₹100 off",
    subtitle: "for weekend rides",
    code: "WEEKEND",
    ...TONES[3],
  },
];

const OfferCardItem = ({ offer }: { offer: OfferCard }) => {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("offers");

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${offer.tone} ${offer.border} ${offer.glow}`}
    >
      {/* Decorative sparkle */}
      <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/40 blur-2xl dark:bg-white/5" />

      <div className="relative">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-lg ${offer.iconBg}`}
          >
            <BadgePercent className="h-4 w-4" />
          </div>
          <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {t("limitedOffer")}
          </span>
        </div>

        <p className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          {offer.title}
        </p>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
          {offer.subtitle}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 dark:border-white/20 dark:bg-white/5">
            <span className="text-xs font-bold tracking-wider text-rose-600 dark:text-rose-400">
              {offer.code}
            </span>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-700 active:scale-95 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-white/20"
            aria-label="Copy code"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const OffersSection = () => {
  const t = useTranslations("offers");
  const [offers, setOffers] = useState<OfferCard[]>(FALLBACK);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(apiUrl("/offers?page=1&limit=4"), {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        if (!rows.length) return;

        const mapped: OfferCard[] = rows.map(
          (item: Record<string, unknown>, i: number) => {
            const dv = Number(item?.discountValue || 0);
            const isPct = item?.discountType === "percentage";
            return {
              title: isPct ? `${dv}% off` : `Flat ₹${dv} off`,
              subtitle:
                typeof item?.minOrderAmount === "number"
                  ? `Min booking ₹${item.minOrderAmount}`
                  : "On selected bookings",
              code: String(item?.code || ""),
              ...TONES[i % TONES.length],
            };
          },
        );
        const valid = mapped.filter((o) => o.code);
        if (valid.length) setOffers(valid);
      } catch (e) {
        if ((e as Error).name !== "AbortError") console.error(e);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  return (
    <section className="bg-slate-50 dark:bg-[#0b1020]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-rose-200/60 bg-rose-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
              <Sparkles className="h-3 w-3" />
              Exclusive Deals
            </div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
              Bus Booking Offers
            </h2>
            <p className="mt-1 max-w-lg text-sm text-slate-500 dark:text-slate-400">
              {t("offerDescription")}
            </p>
          </div>
          <Link
            href="/offers"
            className="hidden items-center gap-1 text-sm font-semibold text-rose-600 transition hover:gap-2 sm:flex dark:text-rose-400"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Grid */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {offers.map((offer) => (
            <OfferCardItem key={offer.code} offer={offer} />
          ))}
        </div>

        <Link
          href="/offers"
          className="mt-6 flex items-center justify-center gap-1 text-sm font-semibold text-rose-600 sm:hidden dark:text-rose-400"
        >
          View All Offers <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
};

export default OffersSection;
