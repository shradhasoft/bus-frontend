"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";

import { apiUrl } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

type OwnerReview = {
  _id: string;
  user?: {
    _id?: string;
    fullName?: string;
    email?: string;
  };
  bus?: {
    _id?: string;
    busName?: string;
    busNumber?: string;
  };
  route?: {
    routeCode?: string;
    origin?: string;
    destination?: string;
  };
  rating?: number;
  comment?: string;
  createdAt?: string;
};

type OwnerBusSummary = {
  busId: string;
  busName?: string | null;
  busNumber?: string | null;
  avgRating?: number;
  reviewCount?: number;
  busProfileRating?: number;
};

type OwnerReviewStats = {
  avgRating?: number;
  totalReviews?: number;
  distribution?: Record<string, number>;
};

type OwnerReviewPagination = {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
};

type OwnerReviewsPayload = {
  reviews?: OwnerReview[];
  busSummaries?: OwnerBusSummary[];
  stats?: OwnerReviewStats;
  pagination?: OwnerReviewPagination;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRoute = (review: OwnerReview) => {
  const origin = review.route?.origin || "-";
  const destination = review.route?.destination || "-";
  return `${origin} -> ${destination}`;
};

const getBusLabel = (busSummary: OwnerBusSummary) =>
  `${busSummary.busName || "Unnamed bus"} (${busSummary.busNumber || "-"})`;

const parseDistribution = (distribution?: Record<string, number>) => ({
  1: Number(distribution?.["1"] || 0),
  2: Number(distribution?.["2"] || 0),
  3: Number(distribution?.["3"] || 0),
  4: Number(distribution?.["4"] || 0),
  5: Number(distribution?.["5"] || 0),
});

export default function OwnerReviewsView() {
  const [reviews, setReviews] = useState<OwnerReview[]>([]);
  const [busSummaries, setBusSummaries] = useState<OwnerBusSummary[]>([]);
  const [stats, setStats] = useState<OwnerReviewStats>({});
  const [pagination, setPagination] = useState<OwnerReviewPagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [selectedBusId, setSelectedBusId] = useState("all");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  const distribution = useMemo(
    () => parseDistribution(stats.distribution),
    [stats.distribution],
  );

  const reviewedBusCount = useMemo(
    () =>
      busSummaries.filter((bus) => Number(bus.reviewCount || 0) > 0).length,
    [busSummaries],
  );

  const averageRating = Number(stats.avgRating || 0);
  const totalReviews = Number(stats.totalReviews || 0);
  const totalBuses = busSummaries.length;

  const buildHeaders = useCallback(async () => {
    const token = await firebaseAuth.currentUser?.getIdToken().catch(() => null);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const loadOverview = useCallback(
    async (options?: { background?: boolean }) => {
      const isBackgroundRefresh = Boolean(options?.background);
      if (isBackgroundRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const headers = await buildHeaders();
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (search) {
          params.set("search", search);
        }
        if (ratingFilter !== "all") {
          params.set("rating", ratingFilter);
        }
        if (selectedBusId !== "all") {
          params.set("busId", selectedBusId);
        }

        const response = await fetch(
          apiUrl(`/api/reviews/owner/overview?${params.toString()}`),
          {
            method: "GET",
            credentials: "include",
            headers,
            cache: "no-store",
          },
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load owner reviews.");
        }

        const data: OwnerReviewsPayload = payload?.data || {};
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        setBusSummaries(
          Array.isArray(data.busSummaries) ? data.busSummaries : [],
        );
        setStats(data.stats || {});
        const nextPagination = data.pagination || {};
        setPagination({
          page: Number(nextPagination.page || page),
          limit: Number(nextPagination.limit || limit),
          total: Number(nextPagination.total || 0),
          totalPages: Number(nextPagination.totalPages || 1),
          hasNext: Boolean(nextPagination.hasNext),
          hasPrevious: Boolean(nextPagination.hasPrevious),
        });
      } catch (requestError) {
        setError(
          (requestError as Error).message || "Unable to load owner reviews.",
        );
      } finally {
        if (isBackgroundRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [buildHeaders, limit, page, ratingFilter, search, selectedBusId],
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadOverview({ background: true });
    }, 30000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadOverview]);

  const pageInfo = pagination.page || page;
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));
  const total = Number(pagination.total || 0);
  const startIndex = total === 0 ? 0 : (pageInfo - 1) * limit + 1;
  const endIndex = total === 0 ? 0 : Math.min(total, pageInfo * limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Owner Insights
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Bus Ratings & Reviews
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            View ratings and user feedback for your own buses.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadOverview({ background: true })}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
            Overall Rating
          </p>
          <p className="mt-2 flex items-center gap-1 text-2xl font-bold text-amber-800 dark:text-amber-200">
            {averageRating.toFixed(1)}
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50 px-4 py-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">
            Total Reviews
          </p>
          <p className="mt-2 text-2xl font-bold text-indigo-800 dark:text-indigo-200">
            {totalReviews}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            Buses Reviewed
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-200">
            {reviewedBusCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Owned Buses
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {totalBuses}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Rating Distribution
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          {[5, 4, 3, 2, 1].map((star) => (
            <div
              key={star}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5"
            >
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {star} Star
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {distribution[star as 1 | 2 | 3 | 4 | 5]}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="xl:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Search
            </span>
            <span className="mt-1 flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 dark:border-white/10 dark:bg-white/5">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Reviewer, bus, route, comment..."
                className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200"
              />
            </span>
          </label>

          <label>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Bus
            </span>
            <select
              value={selectedBusId}
              onChange={(event) => {
                setSelectedBusId(event.target.value);
                setPage(1);
              }}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:[color-scheme:dark]"
            >
              <option value="all">All buses</option>
              {busSummaries.map((bus) => (
                <option key={bus.busId} value={bus.busId}>
                  {getBusLabel(bus)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Rating
            </span>
            <select
              value={ratingFilter}
              onChange={(event) => {
                setRatingFilter(event.target.value);
                setPage(1);
              }}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:[color-scheme:dark]"
            >
              <option value="all">All ratings</option>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
          </label>

          <label>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Rows
            </span>
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:[color-scheme:dark]"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900/70">
        <div className="max-h-[620px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100/95 text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Reviewer</th>
                <th className="px-6 py-4 font-semibold">Bus</th>
                <th className="px-6 py-4 font-semibold">Route</th>
                <th className="px-6 py-4 font-semibold">Rating</th>
                <th className="px-6 py-4 font-semibold">Comment</th>
                <th className="px-6 py-4 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading reviews...
                    </span>
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300"
                  >
                    No reviews found for current filters.
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr
                    key={review._id}
                    className="bg-white/60 transition hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {review.user?.fullName || "Deleted user"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {review.user?.email || "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {review.bus?.busName || "Unknown bus"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {review.bus?.busNumber || "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-700 dark:text-slate-200">
                        {formatRoute(review)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {review.route?.routeCode || "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                          Number(review.rating || 0) >= 4
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
                            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
                        )}
                      >
                        {Number(review.rating || 0).toFixed(1)}
                        <Star className="h-3.5 w-3.5 fill-current" />
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="line-clamp-2 text-slate-700 dark:text-slate-200">
                        {review.comment || "No comment"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                      {formatDate(review.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 px-6 py-4 text-xs dark:border-white/10">
          <div className="text-slate-500 dark:text-slate-400">
            Showing {startIndex} - {endIndex} of {total.toLocaleString()} reviews
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={pageInfo <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <span className="rounded-lg bg-slate-900 px-2.5 py-1.5 font-semibold text-white dark:bg-white dark:text-slate-900">
              {pageInfo}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              disabled={pageInfo >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900/70">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Bus Rating Snapshot
        </p>
        {busSummaries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            No buses found under your ownership.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {busSummaries.map((busSummary) => (
              <div
                key={busSummary.busId}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5"
              >
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {getBusLabel(busSummary)}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {Number(busSummary.reviewCount || 0)} reviews
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                    {Number(busSummary.avgRating || 0).toFixed(1)}
                    <Star className="h-3.5 w-3.5 fill-current" />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
                    Profile: {Number(busSummary.busProfileRating || 0).toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
        <p className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.16em]">
          <MessageSquareText className="h-3.5 w-3.5" />
          Owner Scope
        </p>
        <p className="mt-1">
          Reviews and ratings shown here are restricted to buses linked to your owner account.
        </p>
      </div>
    </div>
  );
}
