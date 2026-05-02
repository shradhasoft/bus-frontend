"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  type JSX,
} from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Copy, Check, Sparkles, ArrowRight } from "lucide-react";
import { useOffers } from "@/lib/hooks/use-offers";

interface OfferCard {
  title: string;
  subtitle: string;
  code: string;
  discount: string;
  gradientStyle: React.CSSProperties;
  accentColor: string;
  tagline: string;
  decorativeIcon: JSX.Element;
}

const BusIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="15" y="20" width="70" height="50" rx="8" />
    <rect
      x="20"
      y="28"
      width="25"
      height="18"
      rx="3"
      fill="white"
      opacity="0.3"
    />
    <rect
      x="55"
      y="28"
      width="25"
      height="18"
      rx="3"
      fill="white"
      opacity="0.3"
    />
    <circle cx="30" cy="78" r="7" />
    <circle cx="70" cy="78" r="7" />
    <rect x="10" y="55" width="80" height="4" rx="2" />
  </svg>
);

const TicketIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M10 30 C10 25 15 20 20 20 L80 20 C85 20 90 25 90 30 L90 42 C85 42 80 46 80 52 C80 58 85 62 90 62 L90 70 C90 75 85 80 80 80 L20 80 C15 80 10 75 10 70 L10 62 C15 62 20 58 20 52 C20 46 15 42 10 42 Z" />
    <line
      x1="35"
      y1="20"
      x2="35"
      y2="80"
      stroke="white"
      strokeWidth="2"
      strokeDasharray="4 4"
      opacity="0.3"
    />
  </svg>
);

const StarBurst = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <polygon points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" />
  </svg>
);

const WalletIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="10" y="25" width="80" height="55" rx="8" />
    <rect
      x="60"
      y="42"
      width="30"
      height="20"
      rx="5"
      fill="white"
      opacity="0.3"
    />
    <circle cx="72" cy="52" r="4" fill="white" opacity="0.5" />
    <path
      d="M10 35 L10 28 C10 22 15 18 20 18 L75 18 C75 18 80 18 80 23 L80 25"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
    />
  </svg>
);

const CARD_THEMES = [
  {
    gradientStyle: {
      background: "linear-gradient(135deg, #f97316, #ea580c, #dc2626)",
    },
    accentColor: "#fde047",
    tagline: "FIRST ORDER",
    decorativeIcon: <BusIcon className="h-full w-full" />,
  },
  {
    gradientStyle: {
      background: "linear-gradient(135deg, #7c3aed, #9333ea, #4338ca)",
    },
    accentColor: "#fde047",
    tagline: "FLASH DEAL",
    decorativeIcon: <TicketIcon className="h-full w-full" />,
  },
  {
    gradientStyle: {
      background: "linear-gradient(135deg, #10b981, #16a34a, #0f766e)",
    },
    accentColor: "#fef08a",
    tagline: "CASHBACK",
    decorativeIcon: <WalletIcon className="h-full w-full" />,
  },
  {
    gradientStyle: {
      background: "linear-gradient(135deg, #ec4899, #e11d48, #be123c)",
    },
    accentColor: "#fde047",
    tagline: "WEEKEND SPECIAL",
    decorativeIcon: <StarBurst className="h-full w-full" />,
  },
] as const;

const OfferCardItem = ({
  offer,
  index,
}: {
  offer: OfferCard;
  index: number;
}) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTranslations("offers");

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API unavailable */
    }
  }, [offer.code]);

  const cardStyle = useMemo(
    () => ({
      ...offer.gradientStyle,
      animationDelay: `${index * 100}ms`,
      minHeight: "260px",
    }),
    [offer.gradientStyle, index],
  );

  return (
    <div
      className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl cursor-pointer"
      style={cardStyle}
    >
      {/* Background decorative circles */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 transition-transform duration-700 group-hover:scale-125" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-black/10 transition-transform duration-700 group-hover:scale-110" />
      <div className="pointer-events-none absolute right-12 bottom-16 h-20 w-20 rounded-full bg-white/5" />

      {/* Decorative icon - large, semi-transparent */}
      <div className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 h-36 w-36 text-white/10 transition-all duration-500 group-hover:text-white/15 group-hover:scale-110 group-hover:rotate-6">
        {offer.decorativeIcon}
      </div>

      {/* Shine sweep on hover */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-linear-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        {/* Top: Tagline badge */}
        <div>
          <span className="inline-block rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">
            {offer.tagline}
          </span>
        </div>

        {/* Middle: Big discount text */}
        <div className="my-4">
          <div
            className="text-5xl font-black leading-none tracking-tight drop-shadow-lg"
            style={{ color: offer.accentColor }}
          >
            {offer.discount}
          </div>
          <div className="mt-1 text-2xl font-extrabold uppercase tracking-wide text-white drop-shadow-sm">
            OFF
          </div>
          <p className="mt-2 text-sm font-medium text-white/80">
            {offer.subtitle}
          </p>
        </div>

        {/* Bottom: Code + copy */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/40 bg-white/15 backdrop-blur-sm px-3 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/70">
              {t("limitedOffer")}:
            </span>
            <span className="text-sm font-black tracking-[0.15em] text-white">
              {offer.code}
            </span>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 ${
              copied
                ? "bg-white text-emerald-600 shadow-lg"
                : "bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm"
            }`}
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
  const { offers, isLoading } = useOffers();

  // Still loading — show skeleton
  if (isLoading || offers === null) {
    return (
      <section className="relative overflow-hidden bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-[#0b1020] dark:via-[#0d1328] dark:to-[#0b1020]">
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          {/* Header skeleton */}
          <div className="flex items-end justify-between">
            <div className="space-y-3">
              <div className="h-6 w-36 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-9 w-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-80 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="hidden h-10 w-28 animate-pulse rounded-full bg-slate-200 sm:block dark:bg-slate-700" />
          </div>
          {/* Cards skeleton */}
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700"
                style={{ minHeight: "260px", animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // No offers — render nothing
  if (offers.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-[#0b1020] dark:via-[#0d1328] dark:to-[#0b1020]">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-0 h-72 w-72 rounded-full bg-orange-100/40 blur-3xl dark:bg-orange-500/5" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-purple-100/40 blur-3xl dark:bg-purple-500/5" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-linear-to-r from-orange-50 to-amber-50 px-4 py-1.5 shadow-sm dark:border-orange-500/20 dark:from-orange-500/10 dark:to-amber-500/10">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600 dark:text-orange-400">
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
            className="group/link hidden items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-orange-600 shadow-sm ring-1 ring-orange-200/60 transition-all hover:gap-2.5 hover:bg-orange-50 hover:shadow-md sm:flex dark:bg-white/5 dark:text-orange-400 dark:ring-orange-500/20 dark:hover:bg-white/10"
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
          className="mt-8 flex items-center justify-center gap-1.5 rounded-full bg-orange-50 px-5 py-2.5 text-sm font-semibold text-orange-600 shadow-sm ring-1 ring-orange-200/60 transition-all hover:bg-orange-100 sm:hidden dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/20"
        >
          View All Offers <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
};

export default OffersSection;
