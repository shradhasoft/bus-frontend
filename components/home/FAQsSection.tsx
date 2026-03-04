"use client";

import React, { useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from 'next-intl';
import { ChevronDown, HelpCircle, ArrowRight } from "lucide-react";

const FAQS = [
  {
    question: "How do I book a bus ticket on BookMySeat?",
    answer:
      "Simply enter your origin, destination, and travel date in the search bar on the home page. Browse available buses, select your preferred seat, fill in passenger details, and complete the payment. You'll receive an instant e-ticket on your phone.",
  },
  {
    question: "Can I cancel or reschedule my booking?",
    answer:
      'Yes! Navigate to "My Bookings" and click "Cancel" on the relevant booking. Cancellations made 24+ hours before departure receive a 90% refund. Rescheduling is available for select routes — check the booking details for eligibility.',
  },
  {
    question: "How does live bus tracking work?",
    answer:
      'Go to the "Track Bus" page and enter your bus name or number. If the bus has GPS tracking enabled, you\'ll see its real-time location on the map with estimated arrival times at upcoming stops.',
  },
  {
    question: "What payment methods are accepted?",
    answer:
      "We accept UPI (Google Pay, PhonePe, Paytm), credit/debit cards (Visa, Mastercard, RuPay), net banking, and popular digital wallets. All transactions are secured with industry-standard encryption.",
  },
  {
    question: "Are there any discounts for first-time users?",
    answer:
      "Absolutely! First-time users get up to 15% off on their first booking with code BMSFIRST. We also have regular seasonal offers, cashback deals, and referral bonuses. Check the Offers page for current promotions.",
  },
  {
    question: "Is BookMySeat available in my city?",
    answer:
      "BookMySeat covers 650,000+ routes across India, connecting 6,200+ bus operators in major cities and towns. Whether it's a metro city or a small town, chances are we have a route for you. Search your route to check availability.",
  },
];

const FAQItem = ({
  faq,
  isOpen,
  onToggle,
}: {
  faq: (typeof FAQS)[0];
  isOpen: boolean;
  onToggle: () => void;
}) => (
  <div
    className={`rounded-2xl border transition-all duration-300 ${
      isOpen
        ? "border-rose-200 bg-white shadow-lg shadow-rose-100/30 dark:border-rose-500/30 dark:bg-slate-800/80 dark:shadow-rose-500/5"
        : "border-slate-200/70 bg-white/80 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/50 dark:hover:border-white/20"
    }`}
  >
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
            isOpen
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
          isOpen ? "rotate-180 text-rose-500" : "text-slate-400"
        }`}
      />
    </button>
    <div
      className={`grid transition-all duration-300 ${
        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden">
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-white/5">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {faq.answer}
          </p>
        </div>
      </div>
    </div>
  </div>
);

const FAQsSection = () => {
  const t = useTranslations('faq');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-white dark:bg-[#0d1225]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500 dark:text-rose-400">
            FAQ
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {t('description')}
          </p>
        </div>

        {/* FAQ list */}
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {FAQS.map((faq, i) => (
            <FAQItem
              key={i}
              faq={faq}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>

        {/* More help link */}
        <div className="mt-10 text-center">
          <Link
            href="/help"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-rose-200 hover:text-rose-600 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-rose-500/30 dark:hover:text-rose-400"
          >
            Visit Help Center
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FAQsSection;
