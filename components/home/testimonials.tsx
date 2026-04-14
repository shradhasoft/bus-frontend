// app/components/Testimonials.tsx
"use client";

import React from "react";
import { useTheme } from "next-themes";
import { User } from "lucide-react";

/* ─────────────────────── Testimonial Data ─────────────────────── */

interface Testimonial {
  id: number;
  quote: string;
  name: string;
  role: string;
  company: string;
  logo: React.ReactNode;
  logoColor: string;
}

/* Traveller icons */
function BusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 6v6m4-6v6m4-6v6M3 20h2l1-2h12l1 2h2M5 14h14V6a2 2 0 00-2-2H7a2 2 0 00-2 2v8zm0 0v3a1 1 0 001 1h2a1 1 0 001-1v-1m6 0v1a1 1 0 001 1h2a1 1 0 001-1v-3" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 9V7a2 2 0 012-2h16a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 100-4zm7-4v2m0 10v2m0-8v4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m22 0v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 11a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    quote:
      "Booked a Bengaluru-to-Chennai sleeper in under a minute. Seat selection was so smooth — felt like booking a flight.",
    name: "Rahul Sharma",
    role: "Software Engineer",
    company: "Bengaluru",
    logo: <BusIcon />,
    logoColor: "#F43F5E",
  },
  {
    id: 2,
    quote:
      "The live GPS tracking is a game-changer. My parents could see exactly where I was — no more anxious phone calls.",
    name: "Ananya Iyer",
    role: "College Student",
    company: "Chennai",
    logo: <MapPinIcon />,
    logoColor: "#3B82F6",
  },
  {
    id: 3,
    quote:
      "We rented a 45-seater for our company offsite to Lonavala. Booking, payment, everything handled in one place.",
    name: "Vikram Desai",
    role: "HR Manager",
    company: "TechNova Solutions",
    logo: <UsersIcon />,
    logoColor: "#F59E0B",
  },
  {
    id: 4,
    quote:
      "Prices were 20% cheaper than other apps for Mumbai-Pune. The fare comparison feature alone makes it worth it.",
    name: "Sneha Kulkarni",
    role: "Freelance Designer",
    company: "Pune",
    logo: <TicketIcon />,
    logoColor: "#10B981",
  },
  {
    id: 5,
    quote:
      "Travelled Delhi to Jaipur overnight. Got instant e-ticket on WhatsApp, no printout needed. Hassle-free experience.",
    name: "Amit Verma",
    role: "Sales Executive",
    company: "Delhi",
    logo: <StarIcon />,
    logoColor: "#EAB308",
  },
  {
    id: 6,
    quote:
      "Refund was processed within 24 hours when my trip got cancelled. No other bus app has been this reliable for me.",
    name: "Deepa Menon",
    role: "Teacher",
    company: "Kochi",
    logo: <ShieldIcon />,
    logoColor: "#8B5CF6",
  },
  {
    id: 7,
    quote:
      "I travel Hyderabad-Vijayawada every weekend. The app remembers my preferences and suggests the best buses. Saves me so much time.",
    name: "Karthik Reddy",
    role: "Business Owner",
    company: "Hyderabad",
    logo: <ClockIcon />,
    logoColor: "#06B6D4",
  },
  {
    id: 8,
    quote:
      "Planned our entire family pilgrimage with the group booking feature. 32 seats, one booking, zero stress.",
    name: "Lakshmi Narayanan",
    role: "Homemaker",
    company: "Madurai",
    logo: <HeartIcon />,
    logoColor: "#EC4899",
  },
];

/* ─────────────────────── Marquee Row ─────────────────────── */

function MarqueeRow({
  items,
  direction = "left",
  speed = 30,
  isDark,
  isPaused,
}: {
  items: Testimonial[];
  direction?: "left" | "right";
  speed?: number;
  isDark: boolean;
  isPaused: boolean;
}) {
  // Double items for seamless loop
  const doubled = [...items, ...items];

  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="flex gap-0"
        style={{
          width: "fit-content",
          animation: `${direction === "left" ? "marquee-left" : "marquee-right"} ${speed}s linear infinite`,
          animationPlayState: isPaused ? "paused" : "running",
        }}
      >
        {doubled.map((t, i) => (
          <TestimonialCard
            key={`${t.id}-${i}`}
            testimonial={t}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── Testimonial Card ─────────────────────── */

function TestimonialCard({
  testimonial,
  isDark,
}: {
  testimonial: Testimonial;
  isDark: boolean;
}) {
  return (
    <div
      className={`group relative flex w-[320px] sm:w-[380px] md:w-[420px] shrink-0 flex-col justify-between border-r border-b p-5 sm:p-6 transition-all duration-300 ${
        isDark
          ? "border-white/10 bg-[#0a0a0a] hover:bg-white/[0.02]"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      {/* Logo with custom color */}
      <div className="mb-4">
        <span style={{ color: testimonial.logoColor }}>{testimonial.logo}</span>
      </div>

      {/* Quote */}
      <p
        className={`mb-5 text-sm leading-relaxed sm:text-[15px] ${
          isDark ? "text-white/70" : "text-slate-600"
        }`}
      >
        {testimonial.quote}
      </p>

      {/* Author */}
      <div className="flex items-center gap-3">
        <div
          className={`h-9 w-9 shrink-0 overflow-hidden rounded-full flex items-center justify-center ${
            isDark ? "bg-white/10" : "bg-slate-200"
          }`}
        >
          <div
            className={`h-full w-full rounded-full flex items-center justify-center ${
              isDark
                ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                : "bg-gradient-to-br from-indigo-400 to-purple-500"
            }`}
          >
            <User className="h-4 w-4 text-white" />
          </div>
        </div>
        <div>
          <p
            className={`text-sm font-medium ${
              isDark ? "text-white/90" : "text-slate-900"
            }`}
          >
            {testimonial.name}
          </p>
          <p
            className={`text-xs ${isDark ? "text-white/50" : "text-slate-500"}`}
          >
            {testimonial.role}, {testimonial.company}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Main Component ─────────────────────── */

export default function Testimonials() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [pausedRow, setPausedRow] = React.useState<number | null>(null);

  const row1 = TESTIMONIALS.slice(0, 4);
  const row2 = TESTIMONIALS.slice(4, 8);

  return (
    <section
      id="testimonials"
      className="relative overflow-hidden py-20 sm:py-28"
    >
      {/* Heading */}
      <div className="mx-auto max-w-2xl px-4 text-center mb-12 sm:mb-16">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500 dark:text-rose-400">
          Testimonials
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl dark:text-white">
          What Our Travellers Say
        </h2>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Hear from our happy travellers who have experienced the best in bus
          booking with us.
        </p>
      </div>

      {/* Marquee Grid Container */}
      <div className="relative mx-4 sm:mx-8 lg:mx-16">
        {/* Outer border container */}
        <div
          className={`relative overflow-hidden rounded-xl border ${
            isDark ? "border-white/10" : "border-slate-200"
          }`}
        >
          {/* Grid overlay for visual effect */}
          <div
            className={`absolute inset-0 pointer-events-none ${
              isDark
                ? "bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)]"
                : "bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)]"
            } bg-[size:60px_60px]`}
          />

          {/* Marquee rows - moving in different directions */}
          <div className="relative">
            <div
              onMouseEnter={() => setPausedRow(1)}
              onMouseLeave={() => setPausedRow(null)}
            >
              <MarqueeRow
                items={row1}
                direction="left"
                speed={40}
                isDark={isDark}
                isPaused={pausedRow === 1}
              />
            </div>
            <div
              onMouseEnter={() => setPausedRow(2)}
              onMouseLeave={() => setPausedRow(null)}
            >
              <MarqueeRow
                items={row2}
                direction="right"
                speed={45}
                isDark={isDark}
                isPaused={pausedRow === 2}
              />
            </div>
          </div>
        </div>

        {/* Fade edges on container */}
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-8 sm:w-16 ${
            isDark
              ? "bg-gradient-to-r from-black to-transparent"
              : "bg-gradient-to-r from-white to-transparent"
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-8 sm:w-16 ${
            isDark
              ? "bg-gradient-to-l from-black to-transparent"
              : "bg-gradient-to-l from-white to-transparent"
          }`}
        />
      </div>
    </section>
  );
}
