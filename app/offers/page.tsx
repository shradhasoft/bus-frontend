"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, Check, Copy, Filter, Search } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

type OfferRecord = {
  id: string;
  title?: string | null;
  description?: string | null;
  code?: string | null;
  discountType?: "percentage" | "fixed" | string | null;
  discountValue?: number | null;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  applicableFor?: "all" | "routes" | "buses" | "users" | string | null;
  status?: string | null;
  targeting?: {
    routeCodes?: string[];
    busCount?: number;
    userCount?: number;
  };
};

type OfferListResponse = {
  success?: boolean;
  message?: string;
  data?: OfferRecord[];
  total?: number;
  page?: number;
  totalPages?: number;
};

const formatDate = (value?: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(date);
};

const formatDiscount = (offer: OfferRecord) => {
  const value = Number(offer.discountValue ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "Discount unavailable";
  if (offer.discountType === "percentage") return `${value}% OFF`;
  return `₹${value} OFF`;
};

const formatApplicability = (offer: OfferRecord) => {
  const scope = offer.applicableFor || "all";
  if (scope === "all") return "Applicable on all bookings";
  if (scope === "routes") {
    const count = Array.isArray(offer.targeting?.routeCodes)
      ? offer.targeting?.routeCodes?.length || 0
      : 0;
    return `Applicable on ${count} route${count === 1 ? "" : "s"}`;
  }
  if (scope === "buses") {
    const count = Number(offer.targeting?.busCount || 0);
    return `Applicable on ${count} bus${count === 1 ? "" : "es"}`;
  }
  const count = Number(offer.targeting?.userCount || 0);
  return `Applicable for ${count} user${count === 1 ? "" : "s"}`;
};

const OffersPage = () => {
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [discountType, setDiscountType] = useState("");
  const [applicableFor, setApplicableFor] = useState("");
  const [copiedCode, setCopiedCode] = useState("");

  const loadOffers = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "12");
        if (search) params.set("search", search);
        if (discountType) params.set("discountType", discountType);
        if (applicableFor) params.set("applicableFor", applicableFor);

        const response = await fetch(apiUrl(`/offers?${params.toString()}`), {
          method: "GET",
          signal,
        });

        const payload = (await response.json().catch(() => ({}))) as OfferListResponse;
        if (!response.ok) {
          throw new Error(payload.message || "Failed to load offers.");
        }

        setOffers(Array.isArray(payload.data) ? payload.data : []);
        setTotal(Number(payload.total) || 0);
        setTotalPages(Math.max(1, Number(payload.totalPages) || 1));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "Something went wrong.");
        }
      } finally {
        setLoading(false);
      }
    },
    [page, search, discountType, applicableFor]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadOffers(controller.signal);
    return () => controller.abort();
  }, [loadOffers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const onCopy = async (code?: string | null) => {
    const normalized = String(code || "").trim();
    if (!normalized) return;

    try {
      await navigator.clipboard.writeText(normalized);
      setCopiedCode(normalized);
      window.setTimeout(() => setCopiedCode(""), 1500);
    } catch {
      setCopiedCode("");
    }
  };

  const emptyState = useMemo(() => !loading && offers.length === 0, [loading, offers]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-10 pt-24 text-slate-900 dark:bg-[#0b1020] dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            BookMySeat Offers
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Discounts & Promo Codes</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {total.toLocaleString()} active offers available right now.
          </p>
        </div>

        <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.09)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search title or promo code"
                className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
              />
            </div>

            <select
              value={discountType}
              onChange={(event) => {
                setDiscountType(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            >
              <option value="">All discount types</option>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>

            <select
              value={applicableFor}
              onChange={(event) => {
                setApplicableFor(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            >
              <option value="">All scopes</option>
              <option value="all">All bookings</option>
              <option value="routes">Specific routes</option>
              <option value="buses">Specific buses</option>
              <option value="users">Specific users</option>
            </select>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-100/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Filter className="h-4 w-4" />
              Page {page} of {totalPages}
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
              Loading offers...
            </div>
          ) : null}

          {emptyState ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-slate-900/60 dark:text-slate-300">
              No offers found for your current filters.
            </div>
          ) : null}

          {!loading
            ? offers.map((offer) => {
                const isCopied = copiedCode === offer.code;
                return (
                  <article
                    key={offer.id}
                    className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-[0_16px_32px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
                          <BadgePercent className="h-3.5 w-3.5" />
                          {formatDiscount(offer)}
                        </p>
                        <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
                          {offer.title || "Offer"}
                        </h2>
                      </div>
                    </div>

                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {offer.description || "No offer description available."}
                    </p>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          Promo Code
                        </p>
                        <button
                          type="button"
                          onClick={() => onCopy(offer.code)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition",
                            isCopied
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
                              : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                          )}
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                        {offer.code || "N/A"}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <p>{formatApplicability(offer)}</p>
                      <p>Valid from: {formatDate(offer.validFrom)}</p>
                      <p>Valid until: {formatDate(offer.validUntil)}</p>
                      {typeof offer.minOrderAmount === "number" ? (
                        <p>Min booking amount: ₹{offer.minOrderAmount.toFixed(2)}</p>
                      ) : null}
                    </div>
                  </article>
                );
              })
            : null}
        </section>

        <section className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="rounded-lg border border-slate-200/80 bg-white px-3 py-1 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-slate-200/80 bg-white px-3 py-1 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            Next
          </button>
        </section>
      </div>
    </main>
  );
};

export default OffersPage;
