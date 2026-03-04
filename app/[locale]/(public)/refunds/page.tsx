"use client";

import React from "react";
import { RefreshCcw, Clock, ShieldCheck, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function RefundsPage() {
  const policies = [
    {
      timeframe: "More than 24 hours before departure",
      refundAmount: "90% Refund",
      charge: "10% Cancellation Charge",
      color:
        "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
    },
    {
      timeframe: "Between 12 to 24 hours before departure",
      refundAmount: "75% Refund",
      charge: "25% Cancellation Charge",
      color:
        "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
    },
    {
      timeframe: "Between 6 to 12 hours before departure",
      refundAmount: "50% Refund",
      charge: "50% Cancellation Charge",
      color:
        "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
    },
    {
      timeframe: "Less than 6 hours before departure",
      refundAmount: "No Refund",
      charge: "100% Cancellation Charge",
      color:
        "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <section className="relative overflow-hidden bg-white dark:bg-slate-900 py-24 sm:py-32">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay dark:opacity-20 hidden dark:block"></div>
        <div className="absolute top-1/2 left-1/2 -ml-120 -mt-80 h-160 w-160 rounded-full bg-blue-100 dark:bg-blue-500/20 blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-white backdrop-blur-md">
            <RefreshCcw className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
            Cancellation & Refunds
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            We understand plans change. Our transparent cancellation policy
            ensures you know exactly what to expect when you need to cancel a
            ticket.
          </p>
        </div>
      </section>

      {/* Policy Details */}
      <section className="mx-auto max-w-7xl px-6 lg:px-8 py-20 -mt-10 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Timeline / Scale */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 dark:shadow-none h-full">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white mb-8 border-b border-slate-100 dark:border-slate-800 pb-4">
                <Clock className="h-6 w-6 text-blue-500" />
                Standard Cancellation Grid
              </h2>

              <div className="space-y-6">
                {policies.map((policy, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl p-4 sm:p-5 ring-1 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow dark:ring-slate-800 dark:hover:ring-slate-700"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {policy.timeframe}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {policy.charge}
                      </p>
                    </div>
                    <div
                      className={`shrink-0 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold ring-1 ring-inset ${policy.color}`}
                    >
                      {policy.refundAmount}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-xl bg-blue-50 p-4 border border-blue-100 dark:bg-blue-500/5 dark:border-blue-500/20">
                <p className="flex gap-3 text-sm text-blue-800 dark:text-blue-300">
                  <AlertCircle className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>
                    <strong>Note:</strong> The exact cancellation policy may
                    vary depending on the specific Bus Operator. Always verify
                    the cancellation policy details on the checkout page before
                    confirming your booking.
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Refund Process */}
          <div className="lg:col-span-5 space-y-8">
            <div className="rounded-3xl bg-slate-900 p-8 shadow-xl text-white">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
                Refund Process
              </h3>
              <ol className="relative border-l border-slate-700 ml-3 space-y-8">
                <li className="pl-8 relative">
                  <div className="absolute w-4 h-4 bg-emerald-500 rounded-full -left-[9px] top-1 ring-4 ring-slate-900"></div>
                  <h4 className="font-bold text-white text-lg">
                    Cancel Ticket
                  </h4>
                  <p className="text-slate-400 text-sm mt-2">
                    Go to{" "}
                    <Link
                      href="/bookings"
                      className="text-emerald-400 hover:underline"
                    >
                      My Bookings
                    </Link>{" "}
                    and click the Cancel button for your active ticket.
                  </p>
                </li>
                <li className="pl-8 relative">
                  <div className="absolute w-4 h-4 bg-emerald-500 rounded-full -left-[9px] top-1 ring-4 ring-slate-900"></div>
                  <h4 className="font-bold text-white text-lg">
                    Refund Initiated
                  </h4>
                  <p className="text-slate-400 text-sm mt-2">
                    Upon successful cancellation, the eligible refund amount is
                    automatically calculated and initiated instantly.
                  </p>
                </li>
                <li className="pl-8 relative">
                  <div className="absolute w-4 h-4 bg-slate-700 rounded-full -left-[9px] top-1 ring-4 ring-slate-900"></div>
                  <h4 className="font-bold text-white text-lg">
                    Amount Credited
                  </h4>
                  <p className="text-slate-400 text-sm mt-2">
                    The refund will reflect in your original payment source
                    within 5-7 business days depending on your bank.
                  </p>
                </li>
              </ol>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900 text-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Need Help with a Refund?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                If you haven&apos;t received your refund after 7 business days,
                please open a support ticket.
              </p>
              <Link
                href="/support/ticket"
                className="inline-flex items-center justify-center w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                Raise Refund Ticket
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
