"use client";

import React from "react";
import { Mail, Phone, MapPin, MessageSquare, Clock, Globe } from "lucide-react";
import Link from "next/link";

export default function ContactUsPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white dark:bg-slate-900 py-24 sm:py-32">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay dark:opacity-20 hidden dark:block"></div>
        <div className="absolute -top-52 -right-52 h-160 w-160 rounded-full bg-rose-100 dark:bg-rose-500/20 blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
            We&apos;re here to help
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Whether you have a question about your booking, need help with a
            refund, or just want to share feedback, our team is ready to assist
            you.
          </p>
        </div>
      </section>

      {/* Contact Options Grid */}
      <section className="mx-auto max-w-7xl px-6 lg:px-8 py-20 -mt-20 relative z-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Phone */}
          <div className="rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200 transition-all hover:-translate-y-1 hover:shadow-2xl dark:bg-slate-900 dark:ring-slate-800 dark:shadow-none">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 mb-6">
              <Phone className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Call Us
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              For immediate assistance with your bookings or urgent inquiries.
            </p>
            <p className="mt-6 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Phone className="h-4 w-4 text-indigo-500" /> +91 12345 67890
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Available Mon-Sat, 8am-10pm IST
            </p>
          </div>

          {/* Email */}
          <div className="rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200 transition-all hover:-translate-y-1 hover:shadow-2xl dark:bg-slate-900 dark:ring-slate-800 dark:shadow-none">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 mb-6">
              <Mail className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Email Us
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              For general queries, feedback, or issues that require detailed
              explanation.
            </p>
            <p className="mt-6 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="h-4 w-4 text-rose-500" /> support@bookmyseat.in
            </p>
            <p className="mt-1 text-xs text-slate-500">
              We aim to reply within 4 hours
            </p>
          </div>

          {/* Ticket */}
          <div className="rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200 transition-all hover:-translate-y-1 hover:shadow-2xl dark:bg-slate-900 dark:ring-slate-800 dark:shadow-none sm:col-span-2 lg:col-span-1">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 mb-6">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Raise a Ticket
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Create a dedicated support ticket to track your issue through to
              resolution.
            </p>
            <div className="mt-6">
              <Link
                href="/support/ticket"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
              >
                Submit a Ticket
              </Link>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Trackable status & priority handling
            </p>
          </div>
        </div>
      </section>

      {/* Office Locations */}
      <section className="bg-white py-24 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Our Offices
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
              Come say hi at any of our primary locations across India.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
            <div className="flex flex-col rounded-3xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center gap-3 mb-6">
                <MapPin className="h-6 w-6 text-rose-500" />
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Bengaluru (HQ)
                </h3>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
                BookMySeat Technologies Pvt. Ltd.
                <br />
                Tower B, Global Tech Park,
                <br />
                Outer Ring Road, Bellandur,
                <br />
                Bengaluru, Karnataka 560103
              </p>
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Clock className="h-4 w-4" /> standard business hours: 9am -
                  6pm
                </p>
              </div>
            </div>

            <div className="flex flex-col rounded-3xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center gap-3 mb-6">
                <Globe className="h-6 w-6 text-rose-500" />
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Mumbai
                </h3>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
                BookMySeat Regional Office
                <br />
                Unit 402, Innov8 Coworking,
                <br />
                Andheri East,
                <br />
                Mumbai, Maharashtra 400069
              </p>
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Clock className="h-4 w-4" /> standard business hours: 9am -
                  6pm
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
