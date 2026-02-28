"use client";

import React from "react";
import {
  BusFront,
  Wifi,
  CheckCircle2,
  BatteryCharging,
  Tv,
  Coffee,
} from "lucide-react";

export default function FleetPage() {
  const fleets = [
    {
      name: "Luxury Sleeper",
      description:
        "Experience premium comfort with fully flat beds, privacy curtains, and advanced suspension for a smooth overnight journey.",
      features: [
        "Fully Flat Beds",
        "Privacy Curtains",
        "Personal Reading Light",
        "USB Charging",
        "Blankets provided",
      ],
      icon: BusFront,
      theme: "from-purple-600 to-indigo-600",
      premium: true,
    },
    {
      name: "AC Semi-Sleeper",
      description:
        "Perfect for daytime travel. Deep reclining seats, ample legroom, and a climate-controlled environment.",
      features: [
        "145° Recline",
        "Adjustable Calf Support",
        "Climate Control AC",
        "Reading Light",
        "Water Bottle",
      ],
      icon: BusFront,
      theme: "from-rose-500 to-orange-500",
      premium: false,
    },
    {
      name: "Volvo Multi-Axle",
      description:
        "The gold standard for intercity travel. Unmatched stability, minimal noise, and superior safety features.",
      features: [
        "Air Suspension",
        "Minimal Cabin Noise",
        "CCTV Surveillance",
        "Emergency Exits",
        "GPS Tracking",
      ],
      icon: BusFront,
      theme: "from-blue-600 to-cyan-500",
      premium: true,
    },
  ];

  const amenities = [
    { name: "High-Speed Wi-Fi", icon: Wifi },
    { name: "Charging Ports", icon: BatteryCharging },
    { name: "Entertainment Setup", icon: Tv },
    { name: "Refreshments", icon: Coffee },
  ];

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
            Meet Our Fleet
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            We partner with the best operators across the country to bring you a
            diverse range of modern, safe, and comfortable buses for every kind
            of journey.
          </p>
        </div>
      </div>

      {/* Fleet Showcase */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          {fleets.map((fleet) => (
            <div
              key={fleet.name}
              className="group relative flex flex-col rounded-3xl bg-white shadow-lg ring-1 ring-slate-200 transition-all hover:shadow-xl dark:bg-slate-900 dark:ring-slate-800 overflow-hidden"
            >
              {fleet.premium && (
                <div className="absolute top-0 right-0 -mr-8 mt-4 w-32 rotate-45 bg-amber-500 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-white shadow-md">
                  Premium
                </div>
              )}
              <div
                className={`h-32 bg-gradient-to-r ${fleet.theme} p-6 flex items-end justify-between`}
              >
                <fleet.icon className="h-12 w-12 text-white/80" />
                <h3 className="text-2xl font-bold text-white">{fleet.name}</h3>
              </div>
              <div className="flex flex-1 flex-col p-8">
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-8">
                  {fleet.description}
                </p>
                <div className="mt-auto">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                    Key Features
                  </h4>
                  <ul className="space-y-3">
                    {fleet.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"
                      >
                        <CheckCircle2 className="h-5 w-5 text-rose-500 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Amenities Section */}
      <div className="bg-white dark:bg-slate-900 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl mb-16">
            Standard Onboard Amenities
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {amenities.map((item) => (
              <div
                key={item.name}
                className="flex flex-col items-center p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-default"
              >
                <div className="h-16 w-16 bg-white dark:bg-slate-700 shadow-sm rounded-full flex items-center justify-center mb-4 text-rose-500">
                  <item.icon className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                  {item.name}
                </h3>
              </div>
            ))}
          </div>
          <p className="mt-12 text-sm text-slate-500">
            *Amenities may vary depending on the operator and bus type selected.
            Check icon indicators when booking.
          </p>
        </div>
      </div>
    </main>
  );
}
