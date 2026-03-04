"use client";

import React from "react";
import {
  Info,
  Luggage,
  Clock,
  CheckCircle2,
  Ticket,
  BusFront,
} from "lucide-react";

export default function GuidelinesPage() {
  const guidelines = [
    {
      title: "Reporting Time",
      icon: Clock,
      points: [
        "Please arrive at the boarding point at least 15-30 minutes prior to the scheduled departure time.",
        "The bus will leave precisely on time, and refunds are not issued for missed buses due to late arrival.",
      ],
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-500/10",
    },
    {
      title: "e-Tickets & ID",
      icon: Ticket,
      points: [
        "A physical printout is not mandatory. You can show the M-ticket (SMS/WhatsApp/Email) to the boarding staff.",
        "You must carry a valid Government-issued Photo ID (Aadhaar, PAN, Voter ID, Passport, or Driving License) for verification.",
      ],
      color: "text-rose-500",
      bg: "bg-rose-50 dark:bg-rose-500/10",
    },
    {
      title: "Luggage Policy",
      icon: Luggage,
      points: [
        "Passengers are allowed one personal bag (max 15 kgs) and one small cabin bag (max 5 kgs).",
        "Excess baggage will be charged extra at the operator's discretion and is subject to space availability.",
        "Flammable items, explosives, and prohibited materials are strictly not allowed.",
      ],
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-500/10",
    },
    {
      title: "Onboard Conduct",
      icon: BusFront,
      points: [
        "Smoking and consumption of alcohol are strictly prohibited inside the bus.",
        "Please be considerate of co-passengers. Avoid playing loud music without headphones.",
        "Pets are generally not allowed unless specifically mentioned by the operator.",
      ],
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <section className="bg-white dark:bg-slate-900 py-24 sm:py-32 rounded-b-[3rem]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white backdrop-blur-md">
            <Info className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Travel Guidelines
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            To ensure a safe, comfortable, and hassle-free journey for everyone,
            please adhere to these important travel guidelines before and during
            your trip.
          </p>
        </div>
      </section>

      {/* Guidelines Grid */}
      <section className="mx-auto max-w-5xl px-6 lg:px-8 pt-16 mt-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {guidelines.map((guide, idx) => {
            const Icon = guide.icon;
            return (
              <div
                key={idx}
                className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md dark:bg-slate-900 dark:ring-slate-800"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl mb-6 ${guide.bg} ${guide.color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  {guide.title}
                </h3>
                <ul className="space-y-3">
                  {guide.points.map((point, pointIdx) => (
                    <li
                      key={pointIdx}
                      className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"
                    >
                      <CheckCircle2
                        className={`h-5 w-5 shrink-0 ${guide.color}`}
                      />
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Disclaimer Area */}
        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <strong>Note:</strong> BookMySeat acts purely as an intermediary
            platform between you and the bus operators. Specific policies
            regarding amenities, seating, and boarding might vary. Always refer
            to the terms listed on your ticket.
          </p>
        </div>
      </section>
    </main>
  );
}
