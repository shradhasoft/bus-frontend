import { Bus, CalendarClock, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Link } from "@/i18n/routing";

const RENT_HIGHLIGHTS = [
  { icon: Users, label: "Corporate and group travel" },
  { icon: ShieldCheck, label: "Verified drivers and operators" },
  { icon: CalendarClock, label: "Flexible hourly and daily plans" },
];

export default function RentBusComingSoonPage() {
  return (
    <main className="relative overflow-hidden bg-slate-50 px-4 pb-20 pt-28 sm:px-6 dark:bg-[#0b1020]">
      <section className="relative mx-auto w-full max-w-5xl">
        <div className="rounded-4xl border border-white/70 bg-white/80 p-6 shadow-2xl shadow-slate-900/15 backdrop-blur-xl sm:p-10 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/30">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
              <Bus className="h-4 w-4" />
              Rent Bus Service
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100/80 px-4 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" />
              Launching soon
            </div>
          </div>

          <h1 className="mt-6 text-balance text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
            Rent a Bus
            <span className="block bg-gradient-to-r from-sky-600 via-teal-500 to-rose-600 bg-clip-text text-transparent dark:from-sky-400 dark:via-teal-300 dark:to-rose-400">
              Coming Soon
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-300">
            We are building a premium rent-bus experience for weddings,
            corporate events, school trips, and private tours. You will be able
            to compare fleets, request instant quotes, and confirm bookings in
            minutes.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {RENT_HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200/70 bg-white/75 p-4 text-sm font-medium text-slate-700 shadow-sm shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200"
              >
                <Icon className="mb-2 h-5 w-5 text-sky-600 dark:text-sky-300" />
                {label}
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/offers"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Explore offers
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Back to home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
