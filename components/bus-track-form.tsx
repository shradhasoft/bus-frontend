"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Navigation,
  Search,
  Loader2,
  ArrowRight,
  Bus,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useTranslations } from "next-intl";

type TrackingBus = {
  _id: string;
  busId?: number;
  busName?: string;
  busNumber?: string;
  operator?: string;
  route?: {
    routeCode?: string;
    origin?: string;
    destination?: string;
  };
};

interface BusTrackFormProps {
  className?: string;
}

const DEBOUNCE_MS = 350;

const BusTrackForm = ({ className }: BusTrackFormProps) => {
  const router = useRouter();
  const t = useTranslations("track");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TrackingBus[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ─── debounced search on keystroke ─── */
  const fetchSuggestions = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    // abort previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearching(true);
    setError(null);

    try {
      const response = await fetch(
        apiUrl(`/v1/tracking/search?q=${encodeURIComponent(trimmed)}`),
        { method: "GET", cache: "no-store", signal: controller.signal },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || t("searchFailed"));

      const items: TrackingBus[] = Array.isArray(data?.data) ? data.data : [];
      setSuggestions(items);
      setShowDropdown(true);
      setHighlightIdx(-1);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || t("searchFailed"));
      }
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, DEBOUNCE_MS);
  };

  /* ─── click outside to close ─── */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ─── keyboard navigation ─── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      handleTrack(suggestions[highlightIdx]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  /* ─── navigate to full tracking page ─── */
  const handleTrack = (bus: TrackingBus) => {
    setShowDropdown(false);
    const busNumber = bus.busNumber || "";
    router.push(`/track?bus=${encodeURIComponent(busNumber)}`);
  };

  const handleSubmit = () => {
    if (highlightIdx >= 0 && suggestions[highlightIdx]) {
      handleTrack(suggestions[highlightIdx]);
    } else if (suggestions.length > 0) {
      handleTrack(suggestions[0]);
    } else {
      fetchSuggestions(query);
    }
  };

  /* ─── cleanup ─── */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div className={className} ref={wrapperRef}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex flex-col gap-3 sm:flex-row sm:items-stretch"
      >
        {/* input with dropdown */}
        <div className="relative flex-1">
          <Navigation className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-rose-500 dark:focus:ring-rose-900/30"
            autoComplete="off"
          />

          {/* suggestion dropdown */}
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl shadow-black/10 dark:border-slate-600 dark:bg-slate-800 dark:shadow-black/30">
              {searching && suggestions.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching buses...
                </div>
              ) : suggestions.length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                  No buses found for &ldquo;{query.trim()}&rdquo;
                </div>
              ) : (
                <>
                  {suggestions.slice(0, 8).map((bus, idx) => (
                    <button
                      key={bus._id}
                      type="button"
                      onClick={() => handleTrack(bus)}
                      onMouseEnter={() => setHighlightIdx(idx)}
                      className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        idx === highlightIdx
                          ? "bg-rose-50 dark:bg-rose-950/20"
                          : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      } ${idx > 0 ? "border-t border-slate-100 dark:border-slate-700" : ""}`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          idx === highlightIdx
                            ? "bg-rose-500 text-white"
                            : "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400"
                        }`}
                      >
                        <Bus className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {bus.busName || t("unnamedBus")}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {bus.busNumber || "—"} ·{" "}
                          {bus.route?.origin && bus.route?.destination
                            ? `${bus.route.origin} → ${bus.route.destination}`
                            : t("routeNA")}
                        </p>
                      </div>

                      <ArrowRight
                        className={`h-4 w-4 shrink-0 transition ${
                          idx === highlightIdx
                            ? "text-rose-500 dark:text-rose-400"
                            : "text-slate-300 group-hover:text-rose-400 dark:text-slate-500"
                        }`}
                      />
                    </button>
                  ))}

                  {/* full tracking link */}
                  <button
                    type="button"
                    onClick={() => router.push("/track")}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-2.5 text-xs font-semibold text-rose-500 transition hover:bg-rose-50 dark:border-slate-700 dark:text-rose-400 dark:hover:bg-rose-950/20"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Open full tracking view
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Track button */}
        <button
          type="submit"
          disabled={searching}
          className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-500 px-8 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-60 dark:bg-rose-600 dark:hover:bg-rose-700"
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Track
        </button>
      </form>

      {/* error */}
      {error && (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
};

export default BusTrackForm;
