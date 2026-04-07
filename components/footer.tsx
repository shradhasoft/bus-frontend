// components/footer.tsx
"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  Bus,
  Instagram,
  Twitter,
  Facebook,
  Youtube,
  ArrowUp,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const NAV_COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Search Buses", href: "/bus-tickets" },
      { label: "Track Live Bus", href: "/track" },
      { label: "Offers & Discounts", href: "/offers" },
      { label: "Route Explorer", href: "/bus-tickets" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About BookMySeat", href: "/about" },
      { label: "Our Fleet", href: "/fleet" },
      { label: "Careers", href: "/careers" },
      { label: "Press & Media", href: "/press" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Contact Us", href: "/contact" },
      { label: "Raise a Ticket", href: "/support/ticket" },
      { label: "Cancellation & Refunds", href: "/refunds" },
      { label: "Travel Guidelines", href: "/guidelines" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
] as const;

const SOCIALS = [
  { label: "Instagram", href: "#", Icon: Instagram },
  { label: "Twitter", href: "#", Icon: Twitter },
  { label: "Facebook", href: "#", Icon: Facebook },
  { label: "YouTube", href: "#", Icon: Youtube },
];

// ─── Footer ───────────────────────────────────────────────────────────────────

const Footer = () => {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-white/8 bg-[#0a0a0a]">
      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-7xl px-6 pt-14 sm:pt-16 lg:px-12">
        {/* Top row */}
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:gap-8">
          {/* ── Left: brand + tagline + copyright + social icons ──────── */}
          <div className="flex shrink-0 flex-col items-center sm:items-start max-w-md">
            {/* Brand */}
            <Link
              href="/"
              className="group mb-5 inline-flex items-center gap-2.5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25 transition-transform group-hover:scale-105">
                <Bus className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold text-white">
                Book<span className="text-rose-500">My</span>Seat
              </span>
            </Link>

            {/* Tagline */}
            <h2 className="text-2xl font-medium tracking-tight text-center sm:text-left text-white/90 leading-snug sm:text-[28px]">
              Search. Book. Travel.
            </h2>

            {/* Copyright */}
            <p className="mt-3 text-[13px] text-center sm:text-left text-white/35">
              &copy; {year}{" "}
              <span className="underline underline-offset-2 decoration-white/20">
                BookMySeat
              </span>{" "}
              {t("craftedWith")} {t("inIndia")}
            </p>

            {/* Social icons */}
            <div className="mt-6 flex items-center gap-3">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/40 transition-colors duration-150 hover:border-rose-500/40 hover:text-rose-400"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* ── Right: nav columns ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4 sm:gap-x-12 lg:gap-x-16">
            {NAV_COLUMNS.map((col) => (
              <div key={col.heading}>
                <p className="text-[13px] font-semibold text-white/40">
                  {col.heading}
                </p>

                <ul className="mt-4 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[13px] text-white/70 transition-colors duration-150 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Outlined watermark ──────────────────────────────────────────── */}
      <div className="relative mt-10 pb-6 sm:mt-14">
        {/* Fog blur overlay */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[50%]"
          style={{
            background:
              "linear-gradient(to top, rgba(10, 10, 10, 1) 0%, rgba(10, 10, 10, 0) 100%)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            maskImage:
              "linear-gradient(to top, black 20%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to top, black 20%, transparent 100%)",
          }}
        />

        <p
          aria-hidden="true"
          className="pointer-events-none select-none whitespace-nowrap text-center font-extrabold leading-[0.82] tracking-tighter"
          style={{
            fontSize: "clamp(72px, 16vw, 280px)",
            color: "transparent",
            WebkitTextStroke: "2px rgba(255, 255, 255, 0.12)",
          }}
        >
          BookMySeat
        </p>
      </div>
    </footer>
  );
};

export default Footer;
