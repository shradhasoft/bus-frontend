"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Loader2, Users, CheckCircle2, Ticket } from "lucide-react";
import { apiUrl } from "@/lib/api";

type BoardingStatus = "booked" | "boarded";

type BlueprintSeat = {
  status: BoardingStatus;
  passengerName: string;
  gender?: string;
  age?: number;
  boardingPoint: string;
  droppingPoint: string;
  bookingId: string;
};

type BoardingBlueprintData = {
  busId: string;
  travelDate: string;
  direction: string;
  summary: {
    totalBooked: number;
    totalBoarded: number;
  };
  seats: Record<string, BlueprintSeat>;
};

type Assignment = {
  _id: string;
  busName?: string;
  busNumber?: string;
  route?: {
    origin?: string;
    destination?: string;
  };
};

export default function BoardingBlueprint({
  assignments,
  refreshTrigger, // Used to trigger a reload when a ticket is manually boarded
}: {
  assignments: Assignment[];
  refreshTrigger: number;
}) {
  const [selectedBus, setSelectedBus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BoardingBlueprintData | null>(null);

  // Set initial bus when assignments load
  useEffect(() => {
    if (assignments.length > 0 && !selectedBus) {
      setSelectedBus(assignments[0]._id);
    }
  }, [assignments, selectedBus]);

  const fetchBlueprint = useCallback(async () => {
    if (!selectedBus) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        apiUrl(`/boarding-blueprint?busId=${selectedBus}`),
        {
          credentials: "include",
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to fetch blueprint");
      }

      setData(result.data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "An error occurred");
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedBus]);

  // Fetch when bus changes or refresh trigger changes (e.g., ticket verified)
  useEffect(() => {
    fetchBlueprint();
  }, [fetchBlueprint, refreshTrigger]);

  const activeBus = useMemo(
    () => assignments.find((b) => b._id === selectedBus),
    [assignments, selectedBus],
  );

  if (assignments.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center dark:border-white/10 dark:bg-slate-900/50">
        <p className="text-sm font-medium text-slate-500">
          No buses assigned to you today.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            Live Boarding Status
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Check which passengers have currently boarded their assigned seats.
          </p>
        </div>

        <select
          value={selectedBus}
          onChange={(e) => setSelectedBus(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100 sm:max-w-xs"
        >
          {assignments.map((assignment) => (
            <option key={assignment._id} value={assignment._id}>
              {assignment.busName || "Unnamed bus"} (
              {assignment.busNumber || "-"})
            </option>
          ))}
        </select>
      </div>

      {loading && !data && (
        <div className="flex justify-center items-center py-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Booked
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                {data.summary.totalBooked}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 p-4 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Boarded
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {data.summary.totalBoarded}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Pending
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">
                {data.summary.totalBooked - data.summary.totalBoarded}
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Route
              </p>
              <p className="mt-1 text-sm font-bold text-indigo-700 dark:text-indigo-300 truncate">
                {activeBus?.route?.origin || "-"} -{" "}
                {activeBus?.route?.destination || "-"}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>Seat Mapping</span>
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm" />{" "}
                  Boarded
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-amber-400 shadow-sm" />{" "}
                  Pending
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {Object.entries(data.seats)
                .sort((a, b) => a[0].localeCompare(b[0])) // visually sort seats alphanumerically
                .map(([seatNumber, details]) => (
                  <div
                    key={seatNumber}
                    className={`relative overflow-hidden rounded-xl border p-3 flex flex-col justify-between min-h-[90px] transition-colors
                        ${
                          details.status === "boarded"
                            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                            : "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                        }`}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={`text-base font-black ${details.status === "boarded" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}
                      >
                        {seatNumber}
                      </span>
                      {details.status === "boarded" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Ticket className="h-4 w-4 text-amber-400" />
                      )}
                    </div>

                    <div className="mt-2 text-xs truncate">
                      <p
                        className={`font-semibold truncate ${details.status === "boarded" ? "text-emerald-800 dark:text-emerald-200" : "text-amber-800 dark:text-amber-200"}`}
                      >
                        {details.passengerName}
                      </p>
                      <p
                        className={`text-[10px] truncate ${details.status === "boarded" ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-amber-600/80 dark:text-amber-400/80"}`}
                      >
                        {details.boardingPoint} - {details.droppingPoint}
                      </p>
                    </div>
                  </div>
                ))}

              {Object.keys(data.seats).length === 0 && (
                <div className="col-span-full py-8 text-center text-sm font-medium text-slate-500">
                  No tickets booked for today&apos;s run yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
