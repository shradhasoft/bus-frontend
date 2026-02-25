// components/footer.tsx
"use client";

import React from "react";
import Link from "next/link";
import {
  Bus,
  Instagram,
  Twitter,
  Facebook,
  Youtube,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  Heart,
  Shield,
  Headphones,
  Smartphone,
} from "lucide-react";

const Footer = () => {
  const footerLinks = {
    product: [
      { name: "Search Buses", href: "/bus-tickets" },
      { name: "Track Live Bus", href: "/track" },
      { name: "Offers & Discounts", href: "/offers" },
      { name: "Route Explorer", href: "/bus-tickets" },
    ],
    company: [
      { name: "About BookMySeat", href: "/about" },
      { name: "Our Fleet", href: "/fleet" },
      { name: "Careers", href: "/careers" },
      { name: "Press & Media", href: "/press" },
    ],
    support: [
      { name: "Help Center", href: "/help" },
      { name: "Contact Us", href: "/help#contact" },
      { name: "Cancellation & Refunds", href: "/help#refunds" },
      { name: "Travel Guidelines", href: "/help#guidelines" },
    ],
    legal: [
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Terms of Service", href: "/terms" },
      { name: "Cookie Policy", href: "/cookies" },
      { name: "Accessibility", href: "/accessibility" },
    ],
  };

  const socialLinks = [
    {
      icon: Instagram,
      href: "#",
      label: "Instagram",
      hoverBg:
        "hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-500",
    },
    { icon: Twitter, href: "#", label: "Twitter", hoverBg: "hover:bg-sky-500" },
    {
      icon: Facebook,
      href: "#",
      label: "Facebook",
      hoverBg: "hover:bg-blue-600",
    },
    { icon: Youtube, href: "#", label: "YouTube", hoverBg: "hover:bg-red-600" },
  ];

  const trustBadges = [
    { icon: Shield, label: "Secure Payments" },
    { icon: Headphones, label: "24/7 Support" },
    { icon: Bus, label: "500+ Routes" },
  ];

  return (
    <footer className="relative overflow-hidden">
      {/* ── Gradient accent band ── */}
      {/* <div className="h-1 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-400" /> */}

      {/* ── Download App section ── */}
      <div className="bg-slate-200 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="relative overflow-hidden rounded-3xl bg-black p-8 shadow-2xl sm:p-10 dark:bg-slate-800">
            {/* Decorative elements */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/[0.03] blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/[0.02] blur-2xl" />

            <div className="relative flex flex-col items-center gap-8 sm:flex-row sm:justify-between">
              <div className="text-center sm:text-left">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
                  <Smartphone className="h-3 w-3" />
                  Mobile App
                </div>
                <h3 className="text-xl font-bold text-white sm:text-2xl">
                  Travel smarter on the go
                </h3>
                <p className="mt-1.5 max-w-md text-sm text-white/50">
                  Book tickets, track buses live, and manage your trips — all
                  from your pocket. Download the BookMySeat app today.
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                {/* Apple App Store */}
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

                {/* Google Play Store */}
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
          </div>
        </div>
      </div>

      {/* ── Main footer body ── */}
      <div className="bg-slate-200 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 pb-8 pt-14">
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-6 lg:gap-8">
            {/* Brand column */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-2">
              <Link
                href="/"
                className="group mb-5 inline-flex items-center gap-2.5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25 transition-transform group-hover:scale-105">
                  <Bus className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  Book<span className="text-rose-500">My</span>Seat
                </span>
              </Link>
              <p className="mb-6 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                India&apos;s smart bus booking platform. Compare operators, pick
                your seat, and travel with real-time GPS tracking and instant
                e-tickets.
              </p>

              {/* Contact info */}
              <div className="space-y-2.5">
                <a
                  href="mailto:support@bookmyseat.in"
                  className="group/link flex items-center gap-2.5 text-sm text-slate-500 transition hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 transition group-hover/link:bg-rose-50 dark:bg-white/5 dark:group-hover/link:bg-rose-500/10">
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                  support@bookmyseat.in
                </a>
                <a
                  href="tel:+911234567890"
                  className="group/link flex items-center gap-2.5 text-sm text-slate-500 transition hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 transition group-hover/link:bg-rose-50 dark:bg-white/5 dark:group-hover/link:bg-rose-500/10">
                    <Phone className="h-3.5 w-3.5" />
                  </div>
                  +91 12345 67890
                </a>
                <div className="flex items-center gap-2.5 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5">
                    <MapPin className="h-3.5 w-3.5" />
                  </div>
                  Bengaluru, Karnataka, India
                </div>
              </div>
            </div>

            {/* Link columns */}
            {(
              [
                ["Product", footerLinks.product],
                ["Company", footerLinks.company],
                ["Support", footerLinks.support],
                ["Legal", footerLinks.legal],
              ] as const
            ).map(([title, links]) => (
              <div key={title}>
                <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-900 dark:text-white">
                  {title}
                </h4>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="group/item flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                      >
                        <ArrowRight className="h-3 w-3 opacity-0 transition-all group-hover/item:-translate-x-0 group-hover/item:opacity-100 -translate-x-2" />
                        <span className="transition-transform group-hover/item:translate-x-0.5">
                          {link.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* ── Trust badges ── */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-slate-200/80 bg-white/80 px-6 py-4 backdrop-blur-sm dark:border-white/5 dark:bg-white/[0.02]">
            {trustBadges.map((badge) => {
              const Icon = badge.icon;
              return (
                <div
                  key={badge.label}
                  className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{badge.label}</span>
                </div>
              );
            })}
          </div>

          {/* ── Bottom bar ── */}
          <div className="mt-8 flex flex-col items-center justify-between gap-5 border-t border-slate-200/80 pt-8 sm:flex-row dark:border-white/5">
            <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
              © {new Date().getFullYear()} BookMySeat. Crafted with
              <Heart className="inline h-3 w-3 text-rose-500" />
              in India
            </p>

            <div className="flex items-center gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-all duration-300 hover:border-transparent hover:text-white hover:shadow-lg active:scale-95 dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-500 dark:hover:text-white ${social.hoverBg}`}
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
