"use client";

import React from "react";
import {
  ArrowUpRight,
  Code,
  Laptop,
  Megaphone,
  Map,
  Users2,
} from "lucide-react";
import Link from "next/link";

export default function CareersPage() {
  const departments = [
    { name: "Engineering", icon: Code, openRoles: 4 },
    { name: "Product & Design", icon: Laptop, openRoles: 2 },
    { name: "Marketing", icon: Megaphone, openRoles: 3 },
    { name: "Operations", icon: Map, openRoles: 5 },
    { name: "Customer Success", icon: Users2, openRoles: 10 },
  ];

  const jobs = [
    {
      title: "Senior Frontend Engineer",
      dept: "Engineering",
      location: "Bengaluru / Remote",
      type: "Full-time",
    },
    {
      title: "Backend Developer (Node.js)",
      dept: "Engineering",
      location: "Bengaluru",
      type: "Full-time",
    },
    {
      title: "Product Designer",
      dept: "Product & Design",
      location: "Remote",
      type: "Full-time",
    },
    {
      title: "Performance Marketing Lead",
      dept: "Marketing",
      location: "Bengaluru",
      type: "Full-time",
    },
    {
      title: "City Operations Manager",
      dept: "Operations",
      location: "Mumbai",
      type: "Full-time",
    },
    {
      title: "Customer Support Executive",
      dept: "Customer Success",
      location: "Bengaluru",
      type: "Full-time",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white py-24 sm:py-32 dark:bg-slate-900">
        <div className="absolute top-0 right-0 -m-32 h-[40rem] w-[40rem] rounded-full bg-rose-50 blur-3xl dark:bg-rose-900/20" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
              Build the future of travel with us
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">
              We&apos;re a team of passionate builders, doers, and thinkers. If
              you love solving complex problems and want to impact how millions
              of people travel, you&apos;ve found your tribe.
            </p>
            <div className="mt-10 flex items-center gap-x-6">
              <a
                href="#open-roles"
                className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 transition-all"
              >
                View Open Roles
              </a>
              <Link
                href="/about"
                className="text-sm font-semibold leading-6 text-slate-900 dark:text-white group flex items-center gap-1"
              >
                Learn about us{" "}
                <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-rose-500 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Departments Grid */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:mx-0">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Our Teams
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
              Find the perfect team where you can do your best work.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            {departments.map((dept) => (
              <div
                key={dept.name}
                className="flex flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 cursor-pointer group"
              >
                <div className="flex w-full items-center justify-between">
                  <div className="rounded-lg bg-rose-50 p-3 ring-1 ring-inset ring-rose-500/20 dark:bg-rose-500/10 dark:ring-rose-400/20 transition-colors group-hover:bg-rose-100 dark:group-hover:bg-rose-500/20">
                    <dept.icon
                      className="h-6 w-6 text-rose-600 dark:text-rose-400"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
                    {dept.openRoles} roles
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold leading-8 tracking-tight text-slate-900 dark:text-white">
                  {dept.name}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Roles List */}
      <section
        id="open-roles"
        className="bg-white py-24 sm:py-32 dark:bg-slate-900 scroll-mt-20"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:mx-0">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Open Positions
            </h2>
          </div>
          <div className="mx-auto mt-10 max-w-2xl lg:mx-0 lg:max-w-none">
            <div className="overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 rounded-2xl dark:bg-slate-900 dark:ring-slate-800">
              <ul
                role="list"
                className="divide-y divide-slate-100 dark:divide-slate-800"
              >
                {jobs.map((job) => (
                  <li
                    key={job.title}
                    className="relative flex justify-between gap-x-6 px-6 py-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex min-w-0 gap-x-4">
                      <div className="min-w-0 flex-auto">
                        <p className="text-sm font-semibold leading-6 text-slate-900 dark:text-white">
                          <a href="#">
                            <span className="absolute inset-x-0 -top-px bottom-0" />
                            {job.title}
                          </a>
                        </p>
                        <p className="mt-1 flex text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {job.dept} &middot; {job.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-x-4">
                      <div className="hidden sm:flex sm:flex-col sm:items-end">
                        <p className="text-sm leading-6 text-slate-900 dark:text-white">
                          {job.location}
                        </p>
                      </div>
                      <ArrowUpRight
                        className="h-5 w-5 flex-none text-slate-400 dark:text-slate-500"
                        aria-hidden="true"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-10 flex justify-center">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Don&apos;t see a role that fits?{" "}
                <a
                  href="mailto:careers@bookmyseat.in"
                  className="font-medium text-rose-600 hover:underline dark:text-rose-400"
                >
                  Send us your resume
                </a>{" "}
                anyway.
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
