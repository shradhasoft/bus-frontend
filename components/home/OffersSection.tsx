"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  BadgePercent,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Tag,
  Zap,
} from "lucide-react";
import { apiUrl } from "@/lib/api";

type OfferCard = {
  title: string;
  subtitle: string;
  code: string;
  tone: string;
  iconBg: string;
  border: string;
  glow: string;
  accent: string;
  codeBg: string;
  codeColor: string;
  icon: ReactNode;
};

const TONES = [
  {
    tone: "bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 dark:from-rose-950/40 dark:via-pink-950/30 dark:to-fuchsia-950/20",
    iconBg: "bg-gradient-to-br from-rose-500 to-pink-600 shadow-rose-500/30",
    border:
      "border-rose-200/80 dark:border-rose-500/20 hover:border-rose-300 dark:hover:border-rose-500/40",
    glow: "group-hover:shadow-rose-200/50 dark:group-hover:shadow-rose-500/15",
    accent: "from-rose-500 to-pink-500",
    codeBg:
      "bg-gradient-to-r from-rose-50 to-pink-50 border-rose-200 dark:from-rose-500/10 dark:to-pink-500/10 dark:border-rose-500/30",
    codeColor: "text-rose-600 dark:text-rose-400",
    icon: <Zap className="h-4.5 w-4.5" />,
  },
  {
    tone: "bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-orange-950/20",
    iconBg:
      "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30",
    border:
      "border-amber-200/80 dark:border-amber-500/20 hover:border-amber-300 dark:hover:border-amber-500/40",
    glow: "group-hover:shadow-amber-200/50 dark:group-hover:shadow-amber-500/15",
    accent: "from-amber-500 to-orange-500",
    codeBg:
      "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 dark:from-amber-500/10 dark:to-orange-500/10 dark:border-amber-500/30",
    codeColor: "text-amber-700 dark:text-amber-400",
    icon: <Tag className="h-4.5 w-4.5" />,
  },
  {
    tone: "bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-950/40 dark:via-blue-950/30 dark:to-indigo-950/20",
    iconBg: "bg-gradient-to-br from-sky-500 to-blue-600 shadow-sky-500/30",
    border:
      "border-sky-200/80 dark:border-sky-500/20 hover:border-sky-300 dark:hover:border-sky-500/40",
    glow: "group-hover:shadow-sky-200/50 dark:group-hover:shadow-sky-500/15",
    accent: "from-sky-500 to-blue-500",
    codeBg:
      "bg-gradient-to-r from-sky-50 to-blue-50 border-sky-200 dark:from-sky-500/10 dark:to-blue-500/10 dark:border-sky-500/30",
    codeColor: "text-sky-700 dark:text-sky-400",
    icon: <BadgePercent className="h-4.5 w-4.5" />,
  },
  {
    tone: "bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/40 dark:via-green-950/30 dark:to-teal-950/20",
    iconBg:
      "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30",
    border:
      "border-emerald-200/80 dark:border-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-500/40",
    glow: "group-hover:shadow-emerald-200/50 dark:group-hover:shadow-emerald-500/15",
    accent: "from-emerald-500 to-teal-500",
    codeBg:
      "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 dark:from-emerald-500/10 dark:to-teal-500/10 dark:border-emerald-500/30",
    codeColor: "text-emerald-700 dark:text-emerald-400",
    icon: <BadgePercent className="h-4.5 w-4.5" />,
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

const OfferCardItem = ({
  offer,
  index,
}: {
  offer: OfferCard;
  index: number;
}) => {
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
      className={`group relative overflow-hidden rounded-2xl border p-6 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${offer.tone} ${offer.border} ${offer.glow}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Animated shine effect */}
      <div className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div
          className={`absolute inset-0 bg-gradient-to-r ${offer.accent} opacity-[0.03] dark:opacity-[0.06]`}
        />
      </div>

      {/* Decorative corner glow */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/50 blur-2xl transition-all duration-500 group-hover:h-32 group-hover:w-32 dark:bg-white/5" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-white/30 blur-2xl dark:bg-white/5" />

      <div className="relative">
        {/* Top row: icon + badge */}
        <div className="flex items-center justify-between">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${offer.iconBg}`}
          >
            {offer.icon}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 shadow-sm backdrop-blur-sm dark:bg-white/10 dark:text-slate-400">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r ${offer.accent} animate-pulse`}
            />
            {t("limitedOffer")}
          </span>
        </div>

        {/* Offer details */}
        <div className="mt-5">
          <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {offer.title}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {offer.subtitle}
          </p>
        </div>

        {/* Separator */}
        <div
          className={`my-4 h-px bg-gradient-to-r from-transparent ${offer.accent} to-transparent opacity-20`}
        />

        {/* Code + copy */}
        <div className="flex items-center gap-2.5">
          <div
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 ${offer.codeBg}`}
          >
            <span
              className={`text-sm font-extrabold tracking-[0.15em] ${offer.codeColor}`}
            >
              {offer.code}
            </span>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200/60 transition-all duration-200 hover:scale-105 hover:text-slate-600 hover:shadow-md active:scale-95 dark:bg-white/10 dark:text-slate-400 dark:ring-white/10 dark:hover:bg-white/20 dark:hover:text-white ${copied ? "!bg-emerald-500 !text-white !ring-emerald-500 !shadow-emerald-500/25" : ""}`}
            aria-label="Copy code"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
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
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#0b1020] dark:via-[#0d1328] dark:to-[#0b1020]">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-0 h-72 w-72 rounded-full bg-rose-100/40 blur-3xl dark:bg-rose-500/5" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-blue-100/40 blur-3xl dark:bg-blue-500/5" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-rose-200/80 bg-gradient-to-r from-rose-50 to-pink-50 px-4 py-1.5 shadow-sm dark:border-rose-500/20 dark:from-rose-500/10 dark:to-pink-500/10">
              <Sparkles className="h-3.5 w-3.5 text-rose-500" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400">
                {t("exclusiveDeals")}
              </span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              {t("busBookingOffers")}
            </h2>
            <p className="mt-2 max-w-lg text-base text-slate-500 dark:text-slate-400">
              {t("offerDescription")}
            </p>
          </div>
          <Link
            href="/offers"
            className="group/link hidden items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-rose-600 shadow-sm ring-1 ring-rose-200/60 transition-all hover:gap-2.5 hover:bg-rose-50 hover:shadow-md sm:flex dark:bg-white/5 dark:text-rose-400 dark:ring-rose-500/20 dark:hover:bg-white/10"
          >
            View All
            <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-0.5" />
          </Link>
        </div>

        {/* Grid */}
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {offers.map((offer, i) => (
            <OfferCardItem key={offer.code} offer={offer} index={i} />
          ))}
        </div>

        <Link
          href="/offers"
          className="mt-8 flex items-center justify-center gap-1.5 rounded-full bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-600 shadow-sm ring-1 ring-rose-200/60 transition-all hover:bg-rose-100 sm:hidden dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20"
        >
          View All Offers <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
};

export default OffersSection;
