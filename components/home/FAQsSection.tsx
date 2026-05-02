"use client";

import React, { useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from 'next-intl';
import { ChevronDown, HelpCircle, ArrowRight } from "lucide-react";

export default function FAQsSection() {
  const t = useTranslations("faq");

  const FAQS = [
    {
      question: t("howToBook"),
      answer: t("howToBookAnswer"),
    },
    {
      question: t("cancelReschedule"),
      answer: t("cancelRescheduleAnswer"),
    },
    {
      question: t("liveTracking"),
      answer: t("liveTrackingAnswer"),
    },
    {
      question: t("paymentMethods"),
      answer: t("paymentMethodsAnswer"),
    },
    {
      question: t("firstTimeDiscounts"),
      answer: t("firstTimeDiscountsAnswer"),
    },
    {
      question: t("availability"),
      answer: t("availabilityAnswer"),
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-slate-50 dark:bg-[#0b1020]">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500 dark:text-rose-400">
            {t("faq")}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            {t("frequentlyAskedQuestions")}
          </h2>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {t("faqDescription")}
          </p>
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className={`rounded-2xl border transition-all duration-300 ${
                openIndex === i
                  ? "border-rose-200 bg-white shadow-lg shadow-rose-100/30 dark:border-rose-500/30 dark:bg-slate-800/80 dark:shadow-rose-500/5"
                  : "border-slate-200/70 bg-white/80 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/50 dark:hover:border-white/20"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      openIndex === i
                        ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                        : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                    }`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {faq.question}
                  </span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                    openIndex === i ? "rotate-180 text-rose-500" : "text-slate-400"
                  }`}
                />
              </button>
              <div
                className={`grid transition-all duration-300 ${
                  openIndex === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-4 pl-14 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* More help link */}
        <div className="mt-10 text-center">
          <Link
            href="/help"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-rose-200 hover:text-rose-600 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-rose-500/30 dark:hover:text-rose-400"
          >
            {t("visitHelpCenter")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
