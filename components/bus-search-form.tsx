"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, isSameDay, parse, startOfDay } from "date-fns";
import {
  ArrowLeftRight,
  Calendar as CalendarIcon,
  MapPin,
  Route,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiUrl } from "@/lib/api";
import { subscribeAuthSessionChanged } from "@/lib/auth-events";
import { cn } from "@/lib/utils";

type BusSearchParams = {
  origin: string;
  destination: string;
  date: string;
  direction?: "forward" | "return" | "both";
};

type BusSearchFormProps = {
  className?: string;
  initialFrom?: string;
  initialTo?: string;
  initialDate?: string;
  direction?: "forward" | "return" | "both";
  onSearch?: (params: BusSearchParams) => void;
};

const MAX_SUGGESTIONS = 8;
const POPULAR_LIMIT = 6;
const RECENT_SEARCH_KEY = "bus:recent-searches";
const MAX_RECENT_SEARCHES = 4;

type RecentSearch = {
  origin: string;
  destination: string;
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const getSuggestions = (
  stops: string[],
  query: string,
  exclude: string
) => {
  const queryText = normalizeText(query);
  const excludeText = normalizeText(exclude);
  const base = queryText
    ? stops.filter((stop) =>
        normalizeText(stop).includes(queryText)
      )
    : stops;

  return base
    .filter((stop) => normalizeText(stop) !== excludeText)
    .slice(0, MAX_SUGGESTIONS);
};

const BusSearchForm = ({
  className,
  initialFrom = "",
  initialTo = "",
  initialDate,
  direction = "both",
  onSearch,
}: BusSearchFormProps) => {
  const router = useRouter();
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  const [departureDate, setDepartureDate] = useState<Date>(
    () => parseDate(initialDate) ?? today
  );
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [stops, setStops] = useState<string[]>([]);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [stopsError, setStopsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  const fromRef = useRef<HTMLDivElement | null>(null);
  const toRef = useRef<HTMLDivElement | null>(null);
  const stopsRequestControllerRef = useRef<AbortController | null>(null);

  const isToday = isSameDay(departureDate, today);
  const isTomorrow = isSameDay(departureDate, tomorrow);

  useEffect(() => {
    setFrom(initialFrom);
  }, [initialFrom]);

  useEffect(() => {
    setTo(initialTo);
  }, [initialTo]);

  useEffect(() => {
    const parsed = parseDate(initialDate);
    if (parsed) setDepartureDate(parsed);
  }, [initialDate]);

  const loadStops = useCallback(async () => {
    stopsRequestControllerRef.current?.abort();
    const controller = new AbortController();
    stopsRequestControllerRef.current = controller;

    setStopsLoading(true);
    setStopsError(null);

    try {
      const response = await fetch(apiUrl("/stops?limit=200"), {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          response.status === 401
            ? "Sign in to see stop suggestions."
            : data?.message || "Unable to load stops right now.";
        if (!controller.signal.aborted) {
          setStops([]);
          setStopsError(message);
        }
        return;
      }

      const fetchedStops = Array.isArray(data?.data?.stops) ? data.data.stops : [];

      if (!controller.signal.aborted) {
        setStops(fetchedStops);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      if (!controller.signal.aborted) {
        setStops([]);
        setStopsError("Unable to load stops right now.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setStopsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadStops();
    return () => {
      stopsRequestControllerRef.current?.abort();
    };
  }, [loadStops]);

  useEffect(() => {
    return subscribeAuthSessionChanged(() => {
      void loadStops();
    });
  }, [loadStops]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(RECENT_SEARCH_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const safeItems = parsed.filter(
          (item) =>
            item &&
            typeof item.origin === "string" &&
            typeof item.destination === "string"
        );
        setRecentSearches(safeItems.slice(0, MAX_RECENT_SEARCHES));
      }
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (fromRef.current && !fromRef.current.contains(target)) {
        setFromOpen(false);
      }
      if (toRef.current && !toRef.current.contains(target)) {
        setToOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const fromSuggestions = useMemo(
    () => getSuggestions(stops, from, to),
    [stops, from, to]
  );

  const toSuggestions = useMemo(
    () => getSuggestions(stops, to, from),
    [stops, to, from]
  );

  const popularStops = useMemo(
    () => stops.slice(0, POPULAR_LIMIT),
    [stops]
  );

  const shouldShowFromDropdown =
    fromOpen &&
    (stopsLoading ||
      Boolean(stopsError) ||
      from.trim().length > 0 ||
      recentSearches.length > 0 ||
      popularStops.length > 0);

  const shouldShowToDropdown =
    toOpen &&
    (stopsLoading ||
      Boolean(stopsError) ||
      to.trim().length > 0 ||
      recentSearches.length > 0 ||
      popularStops.length > 0);

  const storeRecentSearch = (origin: string, destination: string) => {
    if (typeof window === "undefined") return;
    const nextItem = { origin, destination };
    setRecentSearches((prev) => {
      const normalizedOrigin = normalizeText(origin);
      const normalizedDestination = normalizeText(destination);
      const filtered = prev.filter(
        (item) =>
          normalizeText(item.origin) !== normalizedOrigin ||
          normalizeText(item.destination) !== normalizedDestination
      );
      const next = [nextItem, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
    setFromOpen(false);
    setToOpen(false);
    setFormError(null);
  };

  const handleSearch = () => {
    const origin = from.trim();
    const destination = to.trim();

    if (!origin || !destination) {
      setFormError("Enter both origin and destination.");
      return;
    }

    if (normalizeText(origin) === normalizeText(destination)) {
      setFormError("Origin and destination must be different.");
      return;
    }

    const date = format(departureDate, "yyyy-MM-dd");
    setFormError(null);
    storeRecentSearch(origin, destination);

    const params: BusSearchParams = {
      origin,
      destination,
      date,
      direction,
    };

    if (onSearch) {
      onSearch(params);
      return;
    }

    const query = new URLSearchParams({
      origin,
      destination,
      date,
      direction,
    });
    router.push(`/bus-tickets?${query.toString()}`);
  };

  return (
    <div
      role="search"
      className={cn(
        "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[1.2fr_0.18fr_1.2fr_0.9fr_0.6fr_0.6fr_0.9fr]",
        className
      )}
    >
      <div
        ref={fromRef}
        className="relative flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
      >
        <MapPin className="h-4 w-4 text-slate-500" />
        <div className="flex-1">
          <label className="text-xs text-slate-400" htmlFor="search-from">
            Leaving From
          </label>
          <Input
            id="search-from"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setFromOpen(true);
              setFormError(null);
            }}
            onFocus={() => setFromOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSearch();
              }
            }}
            placeholder="City or Station"
            className="h-auto border-0 bg-transparent p-0 text-sm font-semibold text-slate-700 shadow-none focus-visible:ring-0"
          />
        </div>
        {shouldShowFromDropdown && (
          <div className="absolute left-0 right-0 top-full z-[120] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
            {!from.trim() && recentSearches.length > 0 && (
              <div className="border-b border-slate-100">
                <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Recently Searched
                </p>
                <div className="divide-y divide-slate-100">
                  {recentSearches.map((item) => (
                    <button
                      key={`${item.origin}-${item.destination}`}
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setFrom(item.origin);
                        setTo(item.destination);
                        setFromOpen(false);
                        setToOpen(false);
                      }}
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-500">
                        <Route className="h-4 w-4" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-800">
                          {item.origin}{" "}
                          <span className="text-slate-400">→</span>{" "}
                          {item.destination}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Route
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {from.trim() ? "Suggestions" : "Popular Cities"}
              </p>
              <div className="max-h-60 overflow-y-auto py-1 no-scrollbar">
                {stopsLoading ? (
                  <div className="px-4 py-3 text-xs text-slate-500">
                    Loading suggestions...
                  </div>
                ) : stopsError ? (
                  <div className="px-4 py-3 text-xs text-slate-500">
                    {stopsError}
                  </div>
                ) : (from.trim() ? fromSuggestions : popularStops).length > 0 ? (
                  (from.trim() ? fromSuggestions : popularStops).map((stop) => (
                    <button
                      key={stop}
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setFrom(stop);
                        setFromOpen(false);
                      }}
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-500">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {stop}
                        </p>
                        <p className="text-xs text-slate-400">Popular stop</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-slate-500">
                    No matching cities found.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        className="hidden h-14 items-center justify-center rounded-xl border-slate-200 bg-white text-slate-500 lg:flex"
        aria-label="Swap cities"
        onClick={handleSwap}
      >
        <ArrowLeftRight className="h-4 w-4" />
      </Button>

      <div
        ref={toRef}
        className="relative flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
      >
        <MapPin className="h-4 w-4 text-slate-500" />
        <div className="flex-1">
          <label className="text-xs text-slate-400" htmlFor="search-to">
            Going To
          </label>
          <Input
            id="search-to"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setToOpen(true);
              setFormError(null);
            }}
            onFocus={() => setToOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSearch();
              }
            }}
            placeholder="City or Station"
            className="h-auto border-0 bg-transparent p-0 text-sm font-semibold text-slate-700 shadow-none focus-visible:ring-0"
          />
        </div>
        {shouldShowToDropdown && (
          <div className="absolute left-0 right-0 top-full z-[120] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
            {!to.trim() && recentSearches.length > 0 && (
              <div className="border-b border-slate-100">
                <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Recently Searched
                </p>
                <div className="divide-y divide-slate-100">
                  {recentSearches.map((item) => (
                    <button
                      key={`${item.origin}-${item.destination}`}
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setFrom(item.origin);
                        setTo(item.destination);
                        setFromOpen(false);
                        setToOpen(false);
                      }}
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-500">
                        <Route className="h-4 w-4" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-800">
                          {item.origin}{" "}
                          <span className="text-slate-400">→</span>{" "}
                          {item.destination}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Route
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {to.trim() ? "Suggestions" : "Popular Cities"}
              </p>
              <div className="max-h-60 overflow-y-auto py-1 no-scrollbar">
                {stopsLoading ? (
                  <div className="px-4 py-3 text-xs text-slate-500">
                    Loading suggestions...
                  </div>
                ) : stopsError ? (
                  <div className="px-4 py-3 text-xs text-slate-500">
                    {stopsError}
                  </div>
                ) : (to.trim() ? toSuggestions : popularStops).length > 0 ? (
                  (to.trim() ? toSuggestions : popularStops).map((stop) => (
                    <button
                      key={stop}
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setTo(stop);
                        setToOpen(false);
                      }}
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-500">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {stop}
                        </p>
                        <p className="text-xs text-slate-400">Popular stop</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-slate-500">
                    No matching cities found.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-rose-200 hover:bg-white"
            aria-label="Select departure date"
          >
            <CalendarIcon className="h-4 w-4 text-slate-500" />
            <div>
              <p className="text-xs text-slate-400">Departure</p>
              <p className="text-sm font-semibold text-slate-700">
                {format(departureDate, "dd/MM/yyyy")}
              </p>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={departureDate}
            onSelect={(date) => date && setDepartureDate(date)}
            initialFocus
            required
            disabled={{ before: today }}
          />
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant={isToday ? "secondary" : "outline"}
        onClick={() => setDepartureDate(today)}
        aria-pressed={isToday}
        className={cn(
          "h-14 rounded-xl border px-4 py-3 text-sm font-semibold",
          isToday
            ? "border-rose-300 bg-rose-50 text-rose-600"
            : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600"
        )}
      >
        Today
      </Button>

      <Button
        type="button"
        variant={isTomorrow ? "secondary" : "outline"}
        onClick={() => setDepartureDate(tomorrow)}
        aria-pressed={isTomorrow}
        className={cn(
          "h-14 rounded-xl border px-4 py-3 text-sm font-semibold",
          isTomorrow
            ? "border-rose-300 bg-rose-50 text-rose-600"
            : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600"
        )}
      >
        Tomorrow
      </Button>

      <Button
        type="button"
        onClick={handleSearch}
        className="h-14 md:col-span-2 rounded-xl bg-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition-all hover:bg-rose-600 lg:col-span-1"
      >
        <Search className="h-4 w-4" />
        Search
      </Button>

      {(formError || stopsError || stopsLoading) && (
        <div className="md:col-span-2 lg:col-span-7 text-xs text-slate-500">
          {formError ? (
            <span className="text-rose-600">{formError}</span>
          ) : stopsLoading ? (
            <span>Loading stop suggestions...</span>
          ) : (
            <span>{stopsError}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default BusSearchForm;
