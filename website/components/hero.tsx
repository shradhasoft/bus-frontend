"use client";

// components/hero.tsx
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BadgePercent,
  Bus,
  Headphones,
  MapPin,
  Navigation,
  Ticket,
  Zap,
  Users,
} from "lucide-react";
import BusSearchForm from "@/components/bus-search-form";
import { apiUrl } from "@/lib/api";

type OfferCard = {
  title: string;
  subtitle: string;
  code: string;
  tone: string;
};

const Hero = () => {
  const fallbackOffers: OfferCard[] = [
    {
      title: "Get 15% off",
      subtitle: "on your 1st booking",
      code: "BMSFIRST",
      tone: "bg-rose-50 border-rose-100",
    },
    {
      title: "Flat ₹80 off",
      subtitle: "on Bus Booking",
      code: "BMS8OFF",
      tone: "bg-amber-50 border-amber-100",
    },
    {
      title: "Save up to ₹200",
      subtitle: "on cards & wallets",
      code: "SAVE20",
      tone: "bg-purple-50 border-purple-100",
    },
    {
      title: "Up to ₹100 off",
      subtitle: "for weekend rides",
      code: "WEEKEND",
      tone: "bg-blue-50 border-blue-100",
    },
  ];
  const [offers, setOffers] = useState<OfferCard[]>(fallbackOffers);

  useEffect(() => {
    const controller = new AbortController();

    const loadOffers = async () => {
      try {
        const response = await fetch(apiUrl("/offers?page=1&limit=4"), {
          method: "GET",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = await response.json().catch(() => ({}));
        const rows = Array.isArray(payload?.data) ? payload.data : [];

        if (!rows.length) return;

        const tones = [
          "bg-rose-50 border-rose-100",
          "bg-amber-50 border-amber-100",
          "bg-sky-50 border-sky-100",
          "bg-emerald-50 border-emerald-100",
        ];

        const mapped: OfferCard[] = rows.map(
          (item: Record<string, unknown>, index: number) => {
            const discountValue = Number(item?.discountValue || 0);
            const isPercentage = item?.discountType === "percentage";
            const title = isPercentage
              ? `${discountValue}% off`
              : `Flat ₹${discountValue} off`;
            const subtitle =
              typeof item?.minOrderAmount === "number"
                ? `Min booking ₹${item.minOrderAmount}`
                : "On selected bookings";
            return {
              title,
              subtitle,
              code: String(item?.code || ""),
              tone: tones[index % tones.length],
            };
          }
        );

        const valid = mapped.filter((offer) => offer.code);
        if (valid.length > 0) {
          setOffers(valid);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load hero offers:", error);
        }
      }
    };

    void loadOffers();

    return () => controller.abort();
  }, []);

  const features = [
    {
      title: "650,000+ Bus Routes",
      description: "Find the perfect route with extensive coverage.",
      icon: MapPin,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "6,200+ Bus Partners",
      description: "Trusted operators across cities and regions.",
      icon: Users,
      tone: "bg-sky-50 text-sky-600",
    },
    {
      title: "Fastest Booking",
      description: "Book in seconds with instant e-tickets.",
      icon: Zap,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      title: "24/7 Support",
      description: "We’re here before, during, and after your trip.",
      icon: Headphones,
      tone: "bg-rose-50 text-rose-600",
    },
  ];

  return (
    <section id="hero" className="bg-slate-50">
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
          <div className="relative z-20 mx-auto w-full max-w-6xl rounded-3xl border border-white/70 bg-white/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:p-6 lg:max-w-7xl lg:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-600 sm:gap-5">
                <button
                  type="button"
                  className="flex items-center gap-2 text-rose-600 border-b-2 border-rose-600 pb-2"
                >
                  <Ticket className="h-4 w-4" />
                  Book Tickets
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 pb-2 hover:text-slate-800"
                >
                  <Navigation className="h-4 w-4" />
                  Track Buses
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 pb-2 hover:text-slate-800"
                >
                  <Bus className="h-4 w-4" />
                  Rent Buses
                </button>
              </div>
              <p className="text-sm font-semibold text-slate-600">
                India’s Fastest Bus Ticket Booking Platform
              </p>
            </div>

            <div className="mt-5">
              <BusSearchForm />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Bus Booking Discount Offers
          </h2>
          <Link
            href="/offers"
            className="text-sm font-semibold text-rose-500 hover:text-rose-600"
          >
            View All
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {offers.map((offer) => (
            <div
              key={offer.code}
              className={`rounded-2xl border p-4 ${offer.tone}`}
            >
              <div className="flex items-center gap-2 text-rose-500">
                <BadgePercent className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase">Offer</span>
              </div>
              <p className="mt-4 text-xl font-semibold text-slate-900">
                {offer.title}
              </p>
              <p className="text-sm text-slate-600">{offer.subtitle}</p>
              <div className="mt-4 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-600 shadow">
                Code: {offer.code}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-16">
        <h3 className="text-lg font-semibold text-slate-900">
          Why Choose BookMySeat for Bus Ticket Booking?
        </h3>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Experience the next generation of bus travel with real-time tracking,
          verified operators, and a seamless booking experience built for
          comfort and reliability.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${feature.tone}`}
              >
                <feature.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {feature.title}
                </p>
                <p className="text-xs text-slate-600">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
