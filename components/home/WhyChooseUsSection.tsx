"use client";

import React from "react";
import { useTranslations } from 'next-intl';
import {
  MapPin,
  Users,
  Zap,
  Headphones,
  Shield,
  CreditCard,
  Star,
  Clock,
} from "lucide-react";

const STATS = [
  { value: "650K+", label: "Bus Routes", icon: MapPin },
  { value: "6,200+", label: "Bus Partners", icon: Users },
  { value: "50K+", label: "Happy Travellers", icon: Star },
  { value: "4.8★", label: "User Rating", icon: Star },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Fastest Booking",
    description:
      "Book your seat in under 60 seconds with our lightning-fast search and checkout.",
    tone: "from-amber-500 to-orange-500",
    shadow: "shadow-amber-500/25",
  },
  {
    icon: Shield,
    title: "Safe & Secure",
    description:
      "PCI-DSS compliant payments with SSL encryption. Your data is always protected.",
    tone: "from-emerald-500 to-teal-500",
    shadow: "shadow-emerald-500/25",
  },
  {
    icon: CreditCard,
    title: "Easy Refunds",
    description:
      "Hassle-free cancellations with instant refunds — no questions asked policy.",
    tone: "from-blue-500 to-indigo-500",
    shadow: "shadow-blue-500/25",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    description:
      "Our dedicated support team is available around the clock via phone, email, or chat.",
    tone: "from-rose-500 to-pink-500",
    shadow: "shadow-rose-500/25",
  },
  {
    icon: MapPin,
    title: "Live GPS Tracking",
    description:
      "Track your bus on a live map with real-time location updates and accurate ETAs.",
    tone: "from-violet-500 to-purple-500",
    shadow: "shadow-violet-500/25",
  },
  {
    icon: Clock,
    title: "Verified Operators",
    description:
      "Every partner is vetted for safety, punctuality, and service quality standards.",
    tone: "from-cyan-500 to-blue-500",
    shadow: "shadow-cyan-500/25",
  },
];

const WhyChooseUsSection = () => {
  const t = useTranslations('whyChooseUs');
  return (
  <section className="relative overflow-hidden bg-slate-50 dark:bg-[#0b1020]">
    {/* Subtle background decoration */}
    <div className="pointer-events-none absolute -left-40 top-20 h-80 w-80 rounded-full bg-rose-500/5 blur-3xl" />
    <div className="pointer-events-none absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-blue-500/5 blur-3xl" />

    <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      {/* Heading */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500 dark:text-rose-400">
          Trusted by Thousands
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl dark:text-white">
          Why Choose BookMySeat?
        </h2>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {t('whyChooseDescription')}
        </p>
      </div>

      {/* Stats bar */}
      <div className="mt-12 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:p-8 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature cards */}
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.title}
              className="group rounded-2xl border border-slate-200/70 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-slate-900/60"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${feat.tone} ${feat.shadow}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {feat.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {feat.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

}

export default WhyChooseUsSection;
