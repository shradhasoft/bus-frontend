"use client";

import React from "react";
import {
  Bus,
  Users,
  MapPin,
  Shield,
  Star,
  Award,
  Headset,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";

export default function AboutPage() {
  const stats = [
    { label: "Happy Travelers", value: "2M+", icon: Users },
    { label: "Cities Connected", value: "500+", icon: MapPin },
    { label: "Bus Operators", value: "1,200+", icon: Bus },
    { label: "Star Rating", value: "4.8/5", icon: Star },
  ];

  const features = [
    {
      title: "Unmatched Safety",
      description:
        "Every bus on our platform is thoroughly verified for safety and hygiene standards.",
      icon: Shield,
    },
    {
      title: "24/7 Support",
      description:
        "Our customer success team is always ready to help you with your journey.",
      icon: Headset,
    },
    {
      title: "Best Value",
      description:
        "We guarantee the best prices and offer regular rewards for our frequent travelers.",
      icon: Award,
    },
    {
      title: "Continuous Innovation",
      description:
        "From live tracking to VR seat previews, we continuously upgrade our tech.",
      icon: TrendingUp,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white py-20 dark:bg-slate-900 sm:py-32">
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
          />
        </div>

        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
              Transforming the way India travels
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">
              BookMySeat is more than just a ticketing platform. We are on a
              mission to make bus travel seamless, safe, and enjoyable for
              millions of people every day.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="group rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md dark:bg-slate-900 dark:ring-slate-800"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition-colors group-hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <dt className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </dt>
                  <dd className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {stat.value}
                  </dd>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="overflow-hidden bg-white py-24 sm:py-32 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 lg:items-center">
            <div className="lg:pr-8 lg:pt-4">
              <div className="lg:max-w-lg">
                <h2 className="text-base font-semibold leading-7 text-rose-600 dark:text-rose-400">
                  Our Story
                </h2>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                  A better way to get there
                </p>
                <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">
                  Founded in 2024, BookMySeat started with a simple observation:
                  booking a bus ticket was harder than it needed to be. We set
                  out to build a platform that brought transparency,
                  reliability, and modern technology to the intercity bus
                  industry.
                </p>
                <div className="mt-8">
                  <p className="text-slate-600 dark:text-slate-300">
                    Today, we partner with thousands of operators to bring you
                    real-time inventory, live tracking, and instant support. We
                    believe that the journey is just as important as the
                    destination.
                  </p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-xl lg:max-w-none">
                <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/20 to-purple-500/20 mix-blend-multiply" />
                {/* Fallback pattern if image is missing */}
                <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-400 dark:bg-slate-800">
                  <Bus className="h-32 w-32 opacity-20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values / Features */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-rose-600 dark:text-rose-400">
              Why We Exist
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Everything you need for a perfect journey
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
              {features.map((feature) => (
                <div key={feature.title} className="flex flex-col">
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900 dark:text-white">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-600 shadow-sm dark:bg-rose-500">
                      <feature.icon
                        className="h-6 w-6 text-white"
                        aria-hidden="true"
                      />
                    </div>
                    {feature.title}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600 dark:text-slate-300">
                    <p className="flex-auto">{feature.description}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
