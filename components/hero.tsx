"use client";

// components/hero.tsx
import React, { useState } from "react";
import Image from "next/image";
import { Navigation, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import BusSearchForm from "@/components/bus-search-form";
import BusTrackForm from "@/components/bus-track-form";

type HeroTab = "book" | "track";

const Hero = () => {
  const [activeTab, setActiveTab] = useState<HeroTab>("book");
  const t = useTranslations("hero");

  const tabs: { id: HeroTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "book",
      label: t("bookTickets"),
      icon: <Ticket className="h-4 w-4" />,
    },
    {
      id: "track",
      label: t("trackBuses"),
      icon: <Navigation className="h-4 w-4" />,
    },
  ];

  return (
    <section id="hero" className="bg-slate-50 dark:bg-[#0b1020]">
      <div className="relative w-full pb-10 pt-24 sm:pb-12 sm:pt-28 md:h-[480px] md:py-0 md:overflow-visible">
        <Image
          src="/assets/hero.png"
          alt="Modern intercity bus on a scenic highway at sunrise"
          fill
          priority
          sizes="100vw"
          className="hidden object-cover md:block"
        />
        <div className="absolute inset-0 hidden bg-gradient-to-b from-sky-500/10 via-sky-400/10 to-rose-950/40 md:block" />

        <div className="relative px-4 sm:px-6 md:absolute md:inset-0 md:flex md:items-center md:justify-center">
          <div className="relative z-20 mx-auto w-full max-w-6xl rounded-3xl border border-white/70 bg-white/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:p-6 lg:max-w-7xl lg:p-7 dark:border-white/10 dark:bg-slate-900/80">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-600 sm:gap-5 dark:text-slate-300">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 pb-2 transition-colors duration-200 ${
                      activeTab === tab.id
                        ? "border-b-2 border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400"
                        : "border-b-2 border-transparent hover:text-slate-800 dark:hover:text-white"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                {t("tagline")}
              </p>
            </div>

            <div className="mt-5">
              {activeTab === "book" && <BusSearchForm />}
              {activeTab === "track" && <BusTrackForm />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
