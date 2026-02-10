"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bus,
  Clock,
  MapPin,
  Users,
} from "lucide-react";

import BusSearchForm from "@/components/bus-search-form";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";

type SearchResult = {
  _id: string;
  busId?: number;
  busName?: string;
  busNumber?: string;
  operator?: string;
  totalSeats?: number;
  availableSeats?: number;
  farePerPassenger?: number;
  departureTime?: string;
  arrivalTime?: string;
  journeyDuration?: {
    formatted?: string;
  };
  direction?: "forward" | "return";
  boardingPoint?: string;
  droppingPoint?: string;
  route?: {
    origin?: string;
    destination?: string;
    routeCode?: string;
  };
  features?: {
    busType?: string;
    deckCount?: number;
  };
  travelDate?: string;
  dayOfWeek?: string;
};

type FetchError = {
  status?: number;
  message: string;
};

const formatFare = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `INR ${new Intl.NumberFormat("en-IN").format(Math.round(value))}`;
};

const BusTicketsPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const origin = searchParams.get("origin") ?? "";
  const destination = searchParams.get("destination") ?? "";
  const date = searchParams.get("date") ?? "";
  const directionParam = searchParams.get("direction");
  const direction =
    directionParam === "forward" ||
    directionParam === "return" ||
    directionParam === "both"
      ? directionParam
      : "both";

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FetchError | null>(null);

  const hasQuery = useMemo(
    () => Boolean(origin && destination && date),
    [origin, destination, date]
  );

  useEffect(() => {
    if (!hasQuery) {
      setResults([]);
      setError({
        message: "Enter origin, destination, and travel date to search buses.",
      });
      return;
    }

    let active = true;
    const controller = new AbortController();

    const loadResults = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          origin,
          destination,
          date,
          direction,
        });

        const response = await fetch(
          `${apiUrl("/search-bus")}?${params.toString()}`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            data?.message || "Unable to load bus results right now.";
          throw { status: response.status, message } as FetchError;
        }

        const items = Array.isArray(data?.data) ? data.data : [];
        if (active) {
          setResults(items);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const payload = err as FetchError;
        if (active) {
          setResults([]);
          setError({
            status: payload.status,
            message: payload.message || "Unable to load bus results right now.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadResults();

    return () => {
      active = false;
      controller.abort();
    };
  }, [origin, destination, date, direction, hasQuery]);

  const handleSearch = (params: {
    origin: string;
    destination: string;
    date: string;
    direction?: "forward" | "return" | "both";
  }) => {
    const query = new URLSearchParams({
      origin: params.origin,
      destination: params.destination,
      date: params.date,
      direction: params.direction ?? "both",
    });
    router.push(`/bus-tickets?${query.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Bus Tickets
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Find buses for your route
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Use the search below to view available buses and timings.
          </p>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-lg shadow-slate-200/60 backdrop-blur-xl">
          <BusSearchForm
            initialFrom={origin}
            initialTo={destination}
            initialDate={date}
            direction={direction}
            onSearch={handleSearch}
          />
        </div>

        {loading && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading available buses...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            <p>{error.message}</p>
            {error.status === 401 && (
              <div className="mt-4">
                <Button asChild>
                  <Link href="/login">Sign in to search</Link>
                </Button>
              </div>
            )}
          </div>
        )}

        {!loading && !error && results.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No buses found for this route and date. Try another date or city
            pair.
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <div className="space-y-4">
            {results.map((bus) => (
              <div
                key={bus._id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {bus.route?.routeCode || "Route"}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-slate-900">
                      {bus.busName || "Bus Service"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {bus.operator || "Operator"}{" "}
                      {bus.features?.busType
                        ? `• ${bus.features.busType}`
                        : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {bus.boardingPoint || origin} to{" "}
                        {bus.droppingPoint || destination}
                      </span>
                      {bus.direction && (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {bus.direction === "return"
                            ? "Return"
                            : "Forward"}
                        </span>
                      )}
                      {bus.dayOfWeek && (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {bus.dayOfWeek}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Depart
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {bus.departureTime || "--:--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Arrive
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {bus.arrivalTime || "--:--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Duration
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {bus.journeyDuration?.formatted || "--"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    <div className="text-sm text-slate-600">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Fare
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {formatFare(bus.farePerPassenger)}
                      </p>
                    </div>
                    <div className="text-sm text-slate-600">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Seats
                      </p>
                      <p className="mt-1 inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                        <Users className="h-4 w-4 text-slate-500" />
                        {bus.availableSeats ?? "--"}/{bus.totalSeats ?? "--"}
                      </p>
                    </div>
                    <Button className="rounded-full">
                      View Seats
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  {bus.busNumber && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                      <Bus className="h-3.5 w-3.5" />
                      {bus.busNumber}
                    </span>
                  )}
                  {bus.travelDate && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                      <Clock className="h-3.5 w-3.5" />
                      {bus.travelDate}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BusTicketsPage;
