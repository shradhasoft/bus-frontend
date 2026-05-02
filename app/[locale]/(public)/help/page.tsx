"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCcw,
  Search,
  Shield,
  Ticket,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

/* ───────────────────── Data ───────────────────── */

const QUICK_LINKS = [
  {
    icon: Ticket,
    title: "Book Tickets",
    description: "Search routes and reserve your seat in seconds",
    href: "/bus-tickets",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-500/10",
    border: "border-rose-200 dark:border-rose-500/20",
  },
  {
    icon: MapPin,
    title: "Track Your Bus",
    description: "Live GPS tracking of your bus in real-time",
    href: "/track",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/20",
  },
  {
    icon: BadgePercent,
    title: "View Offers",
    description: "Explore promo codes and exclusive discounts",
    href: "/offers",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/20",
  },
  {
    icon: Users,
    title: "My Bookings",
    description: "View, manage, or cancel your reservations",
    href: "/bookings",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
  },
];

type FAQItem = {
  question: string;
  answer: string;
  category: string;
};

const FAQ_DATA: FAQItem[] = [
  {
    category: "Booking",
    question: "How do I book a bus ticket?",
    answer:
      'Go to the "Book Tickets" page, enter your origin, destination, and travel date, then select a bus from the available options. Choose your preferred seat, enter passenger details, apply any promo code, and proceed to payment. You\'ll receive a confirmation with your ticket details.',
  },
  {
    category: "Booking",
    question: "Can I book tickets for multiple passengers at once?",
    answer:
      "Yes! During the booking process, you can select multiple seats and enter details for each passenger. All passengers will be included in a single booking under your account.",
  },
  {
    category: "Booking",
    question: "How far in advance can I book a ticket?",
    answer:
      "You can book tickets as soon as they become available for a route. Typically, bookings open up to 30 days in advance, depending on the bus operator. We recommend booking early to secure your preferred seats.",
  },
  {
    category: "Payment",
    question: "What payment methods are accepted?",
    answer:
      "We accept all major payment methods including UPI (Google Pay, PhonePe, Paytm), credit and debit cards (Visa, Mastercard, RuPay), net banking, and popular digital wallets. All transactions are processed through secure payment gateways.",
  },
  {
    category: "Payment",
    question: "Is my payment information secure?",
    answer:
      "Absolutely. All payment transactions are encrypted using industry-standard SSL/TLS encryption. We do not store your card details on our servers. Payments are processed through PCI-DSS compliant payment gateways.",
  },
  {
    category: "Cancellation",
    question: "How do I cancel my booking?",
    answer:
      'Navigate to "My Bookings", find the booking you wish to cancel, and click "Cancel Booking". The refund will be processed based on the cancellation policy — cancellations made 24+ hours before departure typically receive a full refund minus a small processing fee.',
  },
  {
    category: "Cancellation",
    question: "What is the refund policy?",
    answer:
      "Refunds are processed as follows: cancellations more than 24 hours before departure receive a 90% refund; between 12–24 hours, a 75% refund; between 6–12 hours, a 50% refund. Cancellations within 6 hours of departure are non-refundable. Refunds are credited within 5–7 business days.",
  },
  {
    category: "Tracking",
    question: "How do I track my bus in real-time?",
    answer:
      'Visit the "Track Bus" page and search for your bus using the bus name or number. If GPS tracking is enabled for your bus, you\'ll see its live location on the map along with estimated arrival times at upcoming stops.',
  },
  {
    category: "Tracking",
    question: "Why can't I see my bus on the tracking page?",
    answer:
      "Real-time tracking depends on the bus having an active GPS connection. If the bus hasn't started its journey yet, or if it's in an area with poor network coverage, the location may not be available. Try refreshing after a few minutes.",
  },
  {
    category: "Account",
    question: "How do I create an account?",
    answer:
      'Click "Login" at the top of the page. You can sign in using your phone number or email. A new account will be created automatically on your first login. No separate registration is required.',
  },
  {
    category: "Account",
    question: "I forgot my password. How do I reset it?",
    answer:
      'We use phone/email-based authentication, so there\'s no password to forget! Simply click "Login" and verify your identity via OTP (one-time password) sent to your registered phone number or email.',
  },
  {
    category: "General",
    question: "What amenities are available on the bus?",
    answer:
      "Amenities vary by bus and operator. Common amenities include air conditioning, WiFi, charging points, blankets, water bottles, and entertainment systems. You can view the specific amenities for each bus during the booking process.",
  },
];

const CATEGORIES = [...new Set(FAQ_DATA.map((f) => f.category))];

const GUIDES = [
  {
    icon: Ticket,
    title: "Booking Your First Ticket",
    steps: [
      "Search for your route by entering origin and destination",
      "Select your preferred travel date and find available buses",
      "Choose your seat from the interactive seat layout",
      "Enter passenger details and apply any promo code",
      "Complete payment and receive your e-ticket instantly",
    ],
  },
  {
    icon: MapPin,
    title: "Tracking Your Bus",
    steps: [
      'Navigate to the "Track Bus" page from the main menu',
      "Enter your bus name or number in the search bar",
      "View the live location pinned on the map",
      "Check estimated arrival times at upcoming stops",
      "Share your bus location link with family or friends",
    ],
  },
  {
    icon: RefreshCcw,
    title: "Managing Your Booking",
    steps: [
      "Log in and navigate to My Bookings",
      "Find the booking you want to modify or cancel",
      'Click "View Details" to see full ticket information',
      "Use cancel or modify options as needed",
      "Track refund status in your booking history",
    ],
  },
];

/* ───────────────────── FAQ Accordion ───────────────────── */

const FAQAccordion = ({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem;
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
          className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
            isOpen
              ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
              : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
          }`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {item.question}
        </span>
      </div>
      {isOpen ? (
        <ChevronUp className="h-4 w-4 shrink-0 text-rose-500" />
      ) : (
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      )}
    </button>
    <div
      className={`overflow-hidden transition-all duration-300 ${
        isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      }`}
    >
      <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-white/5">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {item.answer}
        </p>
      </div>
    </div>
  </div>
);

/* ───────────────────── Guide Card ───────────────────── */

const GuideCard = ({ guide }: { guide: (typeof GUIDES)[0] }) => {
  const Icon = guide.icon;
  return (
    <div className="group rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-[0_16px_32px_rgba(15,23,42,0.06)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-slate-900/70 dark:hover:border-white/20">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {guide.title}
        </h3>
      </div>
      <ol className="space-y-3">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">
              {i + 1}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};

/* ───────────────────── Main Page ───────────────────── */

const HelpPage = () => {
  const t = useTranslations("help");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const QUICK_LINKS = [
    {
      icon: Ticket,
      title: t("quickLinks.bookTickets.title"),
      description: t("quickLinks.bookTickets.description"),
      href: "/bus-tickets",
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-500/10",
      border: "border-rose-200 dark:border-rose-500/20",
    },
    {
      icon: MapPin,
      title: t("quickLinks.trackBus.title"),
      description: t("quickLinks.trackBus.description"),
      href: "/track",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-500/10",
      border: "border-blue-200 dark:border-blue-500/20",
    },
    {
      icon: BadgePercent,
      title: t("quickLinks.viewOffers.title"),
      description: t("quickLinks.viewOffers.description"),
      href: "/offers",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      border: "border-amber-200 dark:border-amber-500/20",
    },
    {
      icon: Users,
      title: t("quickLinks.myBookings.title"),
      description: t("quickLinks.myBookings.description"),
      href: "/bookings",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      border: "border-emerald-200 dark:border-emerald-500/20",
    },
  ];

  const GUIDES = [
    {
      icon: Ticket,
      title: t("bookingFirstTicket.title"),
      steps: [
        t("bookingFirstTicket.step1"),
        t("bookingFirstTicket.step2"),
        t("bookingFirstTicket.step3"),
        t("bookingFirstTicket.step4"),
        t("bookingFirstTicket.step5"),
      ],
    },
    {
      icon: MapPin,
      title: t("trackingBus.title"),
      steps: [
        t("trackingBus.step1"),
        t("trackingBus.step2"),
        t("trackingBus.step3"),
        t("trackingBus.step4"),
        t("trackingBus.step5"),
      ],
    },
    {
      icon: RefreshCcw,
      title: t("managingBooking.title"),
      steps: [
        t("managingBooking.step1"),
        t("managingBooking.step2"),
        t("managingBooking.step3"),
        t("managingBooking.step4"),
        t("managingBooking.step5"),
      ],
    },
  ];

  const FAQ_DATA: FAQItem[] = [
    {
      category: t("categories.booking"),
      question: t("faqItems.howToBook.question"),
      answer: t("faqItems.howToBook.answer"),
    },
    {
      category: t("categories.booking"),
      question: t("faqItems.multiplePassengers.question"),
      answer: t("faqItems.multiplePassengers.answer"),
    },
    {
      category: t("categories.booking"),
      question: t("faqItems.advanceBooking.question"),
      answer: t("faqItems.advanceBooking.answer"),
    },
    {
      category: t("categories.payment"),
      question: t("faqItems.paymentMethods.question"),
      answer: t("faqItems.paymentMethods.answer"),
    },
    {
      category: t("categories.payment"),
      question: t("faqItems.paymentSecurity.question"),
      answer: t("faqItems.paymentSecurity.answer"),
    },
    {
      category: t("categories.cancellation"),
      question: t("faqItems.howToCancel.question"),
      answer: t("faqItems.howToCancel.answer"),
    },
    {
      category: t("categories.cancellation"),
      question: t("faqItems.refundPolicy.question"),
      answer: t("faqItems.refundPolicy.answer"),
    },
    {
      category: t("categories.tracking"),
      question: t("faqItems.howToTrack.question"),
      answer: t("faqItems.howToTrack.answer"),
    },
    {
      category: t("categories.tracking"),
      question: t("faqItems.trackingNotAvailable.question"),
      answer: t("faqItems.trackingNotAvailable.answer"),
    },
    {
      category: t("categories.account"),
      question: t("faqItems.howToCreateAccount.question"),
      answer: t("faqItems.howToCreateAccount.answer"),
    },
    {
      category: t("categories.account"),
      question: t("faqItems.forgotPassword.question"),
      answer: t("faqItems.forgotPassword.answer"),
    },
    {
      category: t("categories.general"),
      question: t("faqItems.amenities.question"),
      answer: t("faqItems.amenities.answer"),
    },
  ];

  const filteredFAQs = useMemo(() => {
    let items = FAQ_DATA;
    if (activeCategory !== t("all")) {
      items = items.filter((f) => f.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q),
      );
    }
    return items;
  }, [searchQuery, activeCategory, t]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0b1020] dark:text-slate-100">
      {/* ───── Hero Section ───── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/50 via-rose-50/30 to-slate-50 px-4 pb-20 pt-28 text-slate-900 sm:px-6 lg:px-8 dark:from-[#0b1020] dark:via-[#0d1428] dark:to-[#0b1020] dark:text-white">
        {/* Decorative elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-rose-500/10 blur-3xl dark:bg-rose-500/10" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl dark:bg-blue-500/10" />
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500/5 blur-2xl flex" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-rose-200/60 bg-rose-100/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-rose-600 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-rose-300">
            {t("faq")}
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            {t("heroTitle")}{" "}
            <span className="text-rose-600 dark:text-rose-400">{t("heroHighlight")}</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">
            {t("heroDescription")}
          </p>

          {/* Search Bar */}
          <div className="mt-10 relative mx-auto max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border-0 bg-white px-14 py-4 text-slate-900 shadow-lg ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500 focus:outline-none dark:bg-slate-900 dark:ring-slate-700 dark:placeholder:text-slate-500 dark:focus:ring-rose-400"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setOpenFaqIndex(null);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 transition hover:text-slate-600 dark:hover:text-white"
              >
                {t("clear")}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ───── Quick Links ───── */}
      <section className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.title}
                href={link.href}
                className={`group flex items-start gap-4 rounded-2xl border bg-white/90 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,23,42,0.1)] dark:bg-slate-900/80 ${link.border}`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${link.bg}`}
                >
                  <Icon className={`h-5 w-5 ${link.color}`} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {link.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {link.description}
                  </p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300" />
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-16 sm:px-6 lg:px-8">
        {/* ───── Step-by-Step Guides ───── */}
        <section>
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500 dark:text-rose-400">
              {t("gettingStarted")}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
              {t("stepByStepGuides")}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500 dark:text-slate-400">
              {t("guidesDescription")}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {GUIDES.map((guide) => (
              <GuideCard key={guide.title} guide={guide} />
            ))}
          </div>
        </section>

        {/* ───── FAQ Section ───── */}
        <section>
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500 dark:text-rose-400">
              {t("faq")}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
              {t("frequentlyAskedQuestions")}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500 dark:text-slate-400">
              {t("faqDescription")}
            </p>
          </div>

          {/* Category tabs */}
          <div className="mb-6 flex flex-wrap justify-center gap-2">
            {[t("all"), ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setActiveCategory(cat);
                  setOpenFaqIndex(null);
                }}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  activeCategory === cat
                    ? "border-rose-300 bg-rose-50 text-rose-700 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-white/20"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* FAQ list */}
          <div className="mx-auto max-w-3xl space-y-3">
            {filteredFAQs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center dark:border-white/15 dark:bg-slate-900/60">
                <HelpCircle className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {t("noResults", { query: searchQuery })}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {t("tryDifferent")}
                </p>
              </div>
            ) : (
              filteredFAQs.map((item, i) => (
                <FAQAccordion
                  key={`${item.category}-${i}`}
                  item={item}
                  isOpen={openFaqIndex === i}
                  onToggle={() =>
                    setOpenFaqIndex(openFaqIndex === i ? null : i)
                  }
                />
              ))
            )}
          </div>
        </section>

        {/* ───── Contact Section ───── */}
        <section>
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500 dark:text-rose-400">
              {t("stillNeedHelp")}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
              {t("getInTouch")}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500 dark:text-slate-400">
              {t("getInTouchDescription")}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Phone */}
            <div className="group rounded-3xl border border-slate-200/70 bg-white/85 p-6 text-center shadow-[0_16px_32px_rgba(15,23,42,0.06)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-slate-900/70">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">
                <Phone className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t("callUs")}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("callAvailability")}
              </p>
              <a
                href="tel:+911234567890"
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
              >
                <Phone className="h-3.5 w-3.5" />
                +91 12345 67890
              </a>
            </div>

            {/* Email */}
            <div className="group rounded-3xl border border-slate-200/70 bg-white/85 p-6 text-center shadow-[0_16px_32px_rgba(15,23,42,0.06)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-slate-900/70">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t("emailSupport")}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("emailResponseTime")}
              </p>
              <a
                href="mailto:support@bookmyseat.in"
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
              >
                <Mail className="h-3.5 w-3.5" />
                support@bookmyseat.in
              </a>
            </div>

            {/* WhatsApp */}
            <div className="group rounded-3xl border border-slate-200/70 bg-white/85 p-6 text-center shadow-[0_16px_32px_rgba(15,23,42,0.06)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-slate-900/70 sm:col-span-2 lg:col-span-1">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25">
                <MessageCircle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t("whatsapp")}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("whatsappAvailability")}
              </p>
              <a
                href="https://wa.me/911234567890"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-green-50 px-4 py-2 text-sm font-bold text-green-700 transition hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {t("chatOnWhatsapp")}
              </a>
            </div>
          </div>
        </section>

        {/* ───── Trust Banner ───── */}
        <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10 dark:border-white/10 dark:from-slate-800/50 dark:to-slate-800/50">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-rose-300 backdrop-blur-sm">
              <Shield className="h-3.5 w-3.5" />
              {t("trustedByThousands")}
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">
              {t("safeReliable")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
              {t("safeReliableDescription")}
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-3xl font-bold text-rose-400">50K+</p>
                <p className="mt-1 text-xs text-slate-400">{t("ticketsBooked")}</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-rose-400">99.9%</p>
                <p className="mt-1 text-xs text-slate-400">{t("uptimeGuarantee")}</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-rose-400">4.8★</p>
                <p className="mt-1 text-xs text-slate-400">
                  {t("customerSatisfaction")}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default HelpPage;
