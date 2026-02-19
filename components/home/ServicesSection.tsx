"use client";

import React from "react";
import Link from "next/link";
import { Ticket, MapPin, Bus, Users, ArrowRight } from "lucide-react";

const SERVICES = [
  {
    icon: Ticket,
    title: "Book Bus Tickets",
    description:
      "Search from 650,000+ routes, compare operators, pick your seat, and book in seconds with instant e-tickets.",
    href: "/bus-tickets",
    gradient: "from-rose-500 to-pink-600",
    shadow: "shadow-rose-500/25",
    badge: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  },
  {
    icon: MapPin,
    title: "Live Bus Tracking",
    description:
      "Track your bus in real-time on the map with GPS. Share live location with family and get accurate ETAs.",
    href: "/track",
    gradient: "from-blue-500 to-indigo-600",
    shadow: "shadow-blue-500/25",
    badge: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  },
  {
    icon: Bus,
    title: "Rent a Bus",
    description:
      "Planning a group trip? Rent AC and non-AC buses for weddings, pilgrimages, corporate events, and more.",
    href: "/rent",
    gradient: "from-amber-500 to-orange-600",
    shadow: "shadow-amber-500/25",
    badge:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  },
  {
    icon: Users,
    title: "Group Bookings",
    description:
      "Book for 10+ passengers at once and enjoy special group discounts, priority boarding, and dedicated support.",
    href: "/bus-tickets",
    gradient: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/25",
    badge:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
];

const ServicesSection = () => (
  <section className="bg-white dark:bg-[#0d1225]">
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      {/* Heading */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500 dark:text-rose-400">
          What We Offer
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl dark:text-white">
          Our Services
        </h2>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Everything you need for a smooth and affordable bus journey — all in
          one place.
        </p>
      </div>

      {/* Cards */}
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((svc) => {
          const Icon = svc.icon;
          return (
            <Link
              key={svc.title}
              href={svc.href}
              className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-slate-900/60"
            >
              {/* Decorative corner glow */}
              <div
                className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${svc.gradient} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-10`}
              />

              <div className="relative">
                <div
                  className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${svc.gradient} ${svc.shadow}`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {svc.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {svc.description}
                </p>

                <div className="mt-5 flex items-center gap-1 text-sm font-semibold text-rose-600 transition group-hover:gap-2 dark:text-rose-400">
                  Learn more
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  </section>
);

export default ServicesSection;
