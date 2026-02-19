"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, IndianRupee } from "lucide-react";

const ROUTES = [
  {
    from: "Bengaluru",
    to: "Chennai",
    duration: "5h 30m",
    startingPrice: 450,
    operators: 42,
  },
  {
    from: "Mumbai",
    to: "Pune",
    duration: "3h 30m",
    startingPrice: 350,
    operators: 55,
  },
  {
    from: "Delhi",
    to: "Jaipur",
    duration: "5h 00m",
    startingPrice: 500,
    operators: 38,
  },
  {
    from: "Hyderabad",
    to: "Vijayawada",
    duration: "4h 45m",
    startingPrice: 400,
    operators: 30,
  },
  {
    from: "Chennai",
    to: "Madurai",
    duration: "7h 00m",
    startingPrice: 550,
    operators: 25,
  },
  {
    from: "Bengaluru",
    to: "Hyderabad",
    duration: "9h 30m",
    startingPrice: 700,
    operators: 35,
  },
  {
    from: "Pune",
    to: "Goa",
    duration: "8h 00m",
    startingPrice: 650,
    operators: 20,
  },
  {
    from: "Delhi",
    to: "Agra",
    duration: "3h 30m",
    startingPrice: 300,
    operators: 28,
  },
];

const PopularRoutesSection = () => (
  <section className="bg-white dark:bg-[#0d1225]">
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      {/* Heading */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500 dark:text-rose-400">
          Trending Now
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl dark:text-white">
          Popular Bus Routes
        </h2>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Most searched routes by our travellers. Book early for the best
          prices.
        </p>
      </div>

      {/* Route grid */}
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROUTES.map((route) => (
          <Link
            key={`${route.from}-${route.to}`}
            href={`/bus-tickets?from=${encodeURIComponent(route.from)}&to=${encodeURIComponent(route.to)}`}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-slate-900/60"
          >
            {/* Route line */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div className="h-2.5 w-2.5 rounded-full border-2 border-rose-500 bg-white dark:bg-slate-900" />
                <div className="h-8 w-px bg-gradient-to-b from-rose-500 to-blue-500" />
                <div className="h-2.5 w-2.5 rounded-full border-2 border-blue-500 bg-white dark:bg-slate-900" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {route.from}
                </p>
                <div className="my-1 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                  <Clock className="h-3 w-3" />
                  {route.duration}
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {route.to}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-rose-500 dark:text-slate-600" />
            </div>

            {/* Bottom info */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/5">
              <div className="flex items-center gap-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <IndianRupee className="h-3.5 w-3.5" />
                {route.startingPrice}
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                  onwards
                </span>
              </div>
              <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                <MapPin className="h-3 w-3" />
                {route.operators} buses
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  </section>
);

export default PopularRoutesSection;
