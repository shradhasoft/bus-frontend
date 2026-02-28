"use client";

import React from "react";
import { Download, Mail, ArrowRight } from "lucide-react";

export default function PressPage() {
  const pressReleases = [
    {
      date: "Feb 24, 2026",
      title:
        "BookMySeat Secures Series A Funding to Expand Pan-India Operations",
      excerpt:
        "Leading travel-tech startup BookMySeat announced today that it has raised $25M in Series A funding led by top venture capital firms to aggressively expand its network across Tier 2 and Tier 3 cities in India.",
    },
    {
      date: "Jan 12, 2026",
      title: "BookMySeat Launches Industry-First 'VR Seat Preview' Feature",
      excerpt:
        "In a move to increase transparency in intercity bus travel, BookMySeat introduces Virtual Reality Seat Previews, allowing users to see exactly what they are booking before making a payment.",
    },
    {
      date: "Nov 05, 2025",
      title: "BookMySeat Crosses 2 Million Users Milestone Within First Year",
      excerpt:
        "The platform's focus on user experience, real-time tracking, and 24/7 support has driven unprecedented growth, making it one of the fastest-growing travel apps in the country.",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl text-left">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
              Press & Media
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">
              Get the latest news, press releases, and media resources about
              BookMySeat&apos;s journey in revolutionizing the travel industry.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Main Content - Press Releases */}
          <div className="lg:col-span-2 space-y-12">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
                Latest Press Releases
              </h2>
              <div className="space-y-10">
                {pressReleases.map((release) => (
                  <article
                    key={release.title}
                    className="group flex flex-col items-start justify-between"
                  >
                    <div className="flex items-center gap-x-4 text-xs mb-3">
                      <time
                        dateTime={release.date}
                        className="text-slate-500 dark:text-slate-400"
                      >
                        {release.date}
                      </time>
                      <span className="relative z-10 rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Company News
                      </span>
                    </div>
                    <div className="group relative">
                      <h3 className="mt-3 text-xl font-semibold leading-6 text-slate-900 dark:text-white group-hover:text-rose-600 transition-colors">
                        <a href="#">
                          <span className="absolute inset-0" />
                          {release.title}
                        </a>
                      </h3>
                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {release.excerpt}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center text-sm font-medium text-rose-600 dark:text-rose-400">
                      Read full story <ArrowRight className="ml-1 h-4 w-4" />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - Media Kit & Contacts */}
          <div className="space-y-12 lg:col-span-1">
            {/* Media Resources Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-4">
                Media Kit
              </h3>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                Download our official logos, brand guidelines, and
                high-resolution assets for press use.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <a
                  href="#"
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    Brand Guidelines (PDF)
                  </span>
                  <Download className="h-4 w-4 text-slate-400" />
                </a>
                <a
                  href="#"
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    Logo Package (ZIP)
                  </span>
                  <Download className="h-4 w-4 text-slate-400" />
                </a>
                <a
                  href="#"
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    Executive Headshots
                  </span>
                  <Download className="h-4 w-4 text-slate-400" />
                </a>
              </div>
            </div>

            {/* Media Contact Card */}
            <div className="rounded-2xl border border-slate-200 bg-rose-50 p-8 shadow-sm dark:border-rose-500/10 dark:bg-rose-900/10">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Media Inquiries
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                For journalist inquiries, interview requests, or further
                information, please contact our PR team.
              </p>
              <a
                href="mailto:press@bookmyseat.in"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-rose-600 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-rose-400 dark:ring-slate-700 dark:hover:bg-slate-700 transition"
              >
                <Mail className="h-4 w-4" />
                press@bookmyseat.in
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
