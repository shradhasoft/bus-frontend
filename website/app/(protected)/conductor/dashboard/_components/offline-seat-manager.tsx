"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Undo2,
} from "lucide-react";

import { apiUrl } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";

type Assignment = {
  _id: string;
  busName?: string;
  busNumber?: string;
  operator?: string;
  route?: {
    routeCode?: string;
    origin?: string;
    destination?: string;
  };
};

type SeatRow = {
  seatId: string;
  label: string;
  deck: string;
  row: number;
  column: number;
  status: "available" | "booked" | "locked";
  isOfflineBooked?: boolean;
  canUndo?: boolean;
  source?: string | null;
  note?: string | null;
  flags?: {
    blocked?: boolean;
    ladiesSeat?: boolean;
    accessible?: boolean;
    nearWindow?: boolean;
  };
};

type SeatLayoutElement = {
  elementId?: string;
  type?: string;
  seatId?: string;
  position?: {
    x?: number;
    y?: number;
  };
  size?: {
    w?: number;
    h?: number;
  };
};

type SeatLayoutDeck = {
  deck?: string;
  grid?: {
    rows?: number;
    cols?: number;
  };
  elements?: SeatLayoutElement[];
};

type SeatLayoutBlueprint = {
  orientation?: {
    front?: string;
    driverSide?: string;
  };
  decks?: SeatLayoutDeck[];
};

type SeatLayoutPayload = {
  bus?: {
    _id?: string;
    busName?: string;
    busNumber?: string;
    operator?: string;
    route?: {
      routeCode?: string;
      origin?: string;
      destination?: string;
    };
    seatLayout?: SeatLayoutBlueprint | null;
  };
  travelDate?: string;
  direction?: "forward" | "return";
  summary?: {
    totalSeats?: number;
    availableCount?: number;
    bookedCount?: number;
    lockedCount?: number;
    offlineBookedCount?: number;
  };
  seats?: SeatRow[];
};

const todayDateInputValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeSeatToken = (value?: string | null) =>
  String(value || "")
    .trim()
    .toUpperCase();

const getElementPriority = (type: string) => {
  if (type === "SEAT") return 4;
  if (type === "DRIVER" || type === "DOOR") return 3;
  if (type === "STAIRS" || type === "WC") return 2;
  if (type === "AISLE") return 1;
  return 0;
};

const getElementLabel = (type: string) => {
  switch (type) {
    case "AISLE":
      return "AISLE";
    case "DOOR":
      return "DOOR";
    case "DRIVER":
      return "DRIVER";
    case "STAIRS":
      return "STAIRS";
    case "WC":
      return "WC";
    case "ENTRY":
      return "ENTRY";
    case "EXIT":
      return "EXIT";
    default:
      return type;
  }
};

const getElementBaseClass = (type: string) => {
  switch (type) {
    case "AISLE":
      return "border border-slate-200/70 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-500";
    case "DOOR":
      return "border border-amber-300/70 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200";
    case "DRIVER":
      return "border border-indigo-300/70 bg-indigo-100 text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-200";
    case "STAIRS":
      return "border border-cyan-300/70 bg-cyan-100 text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/15 dark:text-cyan-200";
    case "WC":
      return "border border-emerald-300/70 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200";
    case "ENTRY":
      return "border border-sky-300/70 bg-sky-100 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200";
    case "EXIT":
      return "border border-rose-300/70 bg-rose-100 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200";
    case "GAP":
      return "border-transparent bg-transparent text-transparent";
    default:
      return "border border-slate-200/70 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400";
  }
};

const getSeatStatusClass = (seat: SeatRow) => {
  if (seat.status === "available") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/20";
  }
  if (seat.status === "locked") {
    return "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/20";
  }
  if (seat.isOfflineBooked) {
    return "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-violet-500/20";
  }
  return "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/20";
};

const getSeatFlagRingClass = (seat: SeatRow) => {
  if (seat.flags?.blocked) return "ring-2 ring-slate-500/70";
  if (seat.flags?.ladiesSeat) return "ring-2 ring-pink-400";
  if (seat.flags?.accessible) return "ring-2 ring-emerald-400";
  if (seat.flags?.nearWindow) return "ring-2 ring-sky-400";
  return "";
};

const buildFallbackDecks = (seats: SeatRow[]): SeatLayoutDeck[] => {
  const byDeck = new Map<string, SeatRow[]>();

  for (const seat of seats) {
    const deck = normalizeSeatToken(seat.deck) || "LOWER";
    const rows = byDeck.get(deck) || [];
    rows.push(seat);
    byDeck.set(deck, rows);
  }

  return Array.from(byDeck.entries()).map(([deck, deckSeats]) => {
    const validRows = deckSeats
      .map((seat) => Number(seat.row))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const validCols = deckSeats
      .map((seat) => Number(seat.column))
      .filter((value) => Number.isFinite(value) && value >= 0);

    const rowMax = validRows.length ? Math.max(...validRows) : 0;
    const colMax = validCols.length ? Math.max(...validCols) : 0;

    const elements: SeatLayoutElement[] = deckSeats.map((seat, index) => ({
      elementId: `fallback-${deck}-${seat.seatId}-${index}`,
      type: "SEAT",
      seatId: seat.seatId,
      position: {
        x: Number.isFinite(Number(seat.column)) ? Math.max(0, Number(seat.column)) : 0,
        y: Number.isFinite(Number(seat.row)) ? Math.max(0, Number(seat.row)) : index,
      },
      size: { w: 1, h: 1 },
    }));

    return {
      deck,
      grid: {
        rows: Math.max(rowMax + 1, 1),
        cols: Math.max(colMax + 1, 1),
      },
      elements,
    };
  });
};

const OfflineSeatManager = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  const [selectedBusId, setSelectedBusId] = useState<string>("");
  const [travelDate, setTravelDate] = useState(todayDateInputValue());
  const [direction, setDirection] = useState<"forward" | "return">("forward");
  const [seatSearch, setSeatSearch] = useState("");

  const [layoutLoading, setLayoutLoading] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [layoutData, setLayoutData] = useState<SeatLayoutPayload | null>(null);

  const [actionSeatKey, setActionSeatKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);

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

  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    setAssignmentsError(null);

    try {
      const headers = await buildHeaders();
      const response = await fetch(apiUrl("/v1/telemetry/assignments"), {
        method: "GET",
        credentials: "include",
        headers,
        cache: "no-store",
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to load assigned buses.");
      }

      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setAssignments(rows);
      setSelectedBusId((current) => {
        if (current && rows.some((row: Assignment) => row._id === current)) {
          return current;
        }
        return rows[0]?._id || "";
      });
    } catch (error) {
      setAssignments([]);
      setSelectedBusId("");
      setAssignmentsError((error as Error).message || "Unable to load assigned buses.");
    } finally {
      setAssignmentsLoading(false);
    }
  }, [buildHeaders]);

  const loadSeatLayout = useCallback(async () => {
    if (!selectedBusId || !travelDate) {
      setLayoutData(null);
      setSelectedSeatId(null);
      return;
    }

    setLayoutLoading(true);
    setLayoutError(null);

    try {
      const headers = await buildHeaders();
      const params = new URLSearchParams();
      params.set("travelDate", travelDate);
      params.set("direction", direction);

      const response = await fetch(
        apiUrl(
          `/v1/telemetry/conductor/buses/${selectedBusId}/offline-seats?${params.toString()}`,
        ),
        {
          method: "GET",
          credentials: "include",
          headers,
          cache: "no-store",
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to load seat availability.");
      }

      const nextData = payload?.data || null;
      const nextSeats = Array.isArray(nextData?.seats) ? nextData.seats : [];
      setLayoutData(nextData);
      setSelectedSeatId((current) => {
        if (current && nextSeats.some((seat: SeatRow) => seat.seatId === current)) {
          return current;
        }
        const preferred =
          nextSeats.find(
            (seat: SeatRow) => seat.status === "available" && !seat.flags?.blocked,
          ) || nextSeats[0];
        return preferred?.seatId || null;
      });
    } catch (error) {
      setLayoutData(null);
      setSelectedSeatId(null);
      setLayoutError((error as Error).message || "Unable to load seat availability.");
    } finally {
      setLayoutLoading(false);
    }
  }, [buildHeaders, direction, selectedBusId, travelDate]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    void loadSeatLayout();
  }, [loadSeatLayout]);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment._id === selectedBusId) || null,
    [assignments, selectedBusId],
  );

  const seats = useMemo<SeatRow[]>(() => {
    return Array.isArray(layoutData?.seats) ? layoutData.seats : [];
  }, [layoutData]);

  const seatMap = useMemo(() => {
    const map = new Map<string, SeatRow>();
    for (const seat of seats) {
      const key = normalizeSeatToken(seat.seatId);
      if (!key) continue;
      map.set(key, seat);
    }
    return map;
  }, [seats]);

  const matchedSeatIds = useMemo(() => {
    const keyword = seatSearch.trim().toLowerCase();
    if (!keyword) {
      return new Set(seats.map((seat) => normalizeSeatToken(seat.seatId)));
    }

    const matches = new Set<string>();
    for (const seat of seats) {
      const haystack = [seat.label, seat.seatId, seat.deck, seat.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (haystack.includes(keyword)) {
        matches.add(normalizeSeatToken(seat.seatId));
      }
    }
    return matches;
  }, [seatSearch, seats]);

  const visibleSeatCount = matchedSeatIds.size;

  const blueprintDecks = useMemo(() => {
    const sourceDecks = Array.isArray(layoutData?.bus?.seatLayout?.decks)
      ? layoutData?.bus?.seatLayout?.decks
      : [];

    if (sourceDecks.length > 0) {
      return sourceDecks;
    }

    return buildFallbackDecks(seats);
  }, [layoutData?.bus?.seatLayout?.decks, seats]);

  const selectedSeat = selectedSeatId
    ? seatMap.get(normalizeSeatToken(selectedSeatId)) || null
    : null;

  const runSeatAction = useCallback(
    async (seatNumber: string, action: "book" | "unbook") => {
      if (!selectedBusId) return;

      setActionError(null);
      setNotice(null);

      const normalizedSeat = normalizeSeatToken(seatNumber);
      const actionKey = `${action}:${normalizedSeat}`;
      setActionSeatKey(actionKey);

      try {
        const headers = await buildHeaders();
        const response = await fetch(
          apiUrl(`/v1/telemetry/conductor/buses/${selectedBusId}/offline-seats/${action}`),
          {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({
              travelDate,
              direction,
              seatNumber: normalizedSeat,
            }),
          },
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Seat operation failed.");
        }

        setNotice(
          action === "book"
            ? `Seat ${normalizedSeat} marked as offline booked.`
            : `Seat ${normalizedSeat} has been restored to available.`,
        );

        await loadSeatLayout();
      } catch (error) {
        setActionError((error as Error).message || "Seat operation failed.");
      } finally {
        setActionSeatKey(null);
      }
    },
    [buildHeaders, direction, loadSeatLayout, selectedBusId, travelDate],
  );

  const summary = layoutData?.summary || {};

  const selectedActionKey = selectedSeat
    ? selectedSeat.status === "available"
      ? `book:${normalizeSeatToken(selectedSeat.seatId)}`
      : `unbook:${normalizeSeatToken(selectedSeat.seatId)}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Conductor Offline Booking
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">
            Mark Offline Seats
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
            Blueprint view of your bus layout with live availability actions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadAssignments();
            void loadSeatLayout();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/5 lg:grid-cols-4">
        <label className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Assigned Bus
          </span>
          <select
            value={selectedBusId}
            onChange={(event) => setSelectedBusId(event.target.value)}
            disabled={assignmentsLoading}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
          >
            {assignments.length === 0 ? (
              <option value="">No assigned buses</option>
            ) : (
              assignments.map((assignment) => (
                <option key={assignment._id} value={assignment._id}>
                  {assignment.busName || "Unnamed bus"} ({assignment.busNumber || "-"})
                </option>
              ))
            )}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Travel Date
          </span>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={travelDate}
              min={todayDateInputValue()}
              onChange={(event) => setTravelDate(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
            />
          </div>
        </label>

        <label className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Direction
          </span>
          <select
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value === "return" ? "return" : "forward")
            }
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
          >
            <option value="forward">Forward</option>
            <option value="return">Return</option>
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Search Seat
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={seatSearch}
              onChange={(event) => setSeatSearch(event.target.value)}
              placeholder="Seat label or id"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
            />
          </div>
        </label>
      </div>

      {assignmentsError ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {assignmentsError}
        </p>
      ) : null}

      {layoutError ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {layoutError}
        </p>
      ) : null}

      {actionError ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {actionError}
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Total Seats</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {summary.totalSeats ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <p className="text-xs uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-200">
            Available
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-100">
            {summary.availableCount ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50 px-4 py-3 dark:border-rose-500/40 dark:bg-rose-500/10">
          <p className="text-xs uppercase tracking-[0.15em] text-rose-600 dark:text-rose-200">
            Booked
          </p>
          <p className="mt-2 text-2xl font-semibold text-rose-700 dark:text-rose-100">
            {summary.bookedCount ?? 0}
          </p>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-200/80">
            Offline: {summary.offlineBookedCount ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="text-xs uppercase tracking-[0.15em] text-amber-700 dark:text-amber-200">
            Temporarily Locked
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-100">
            {summary.lockedCount ?? 0}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {selectedAssignment?.busName || layoutData?.bus?.busName || "Bus"}
            </p>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
              {(selectedAssignment?.route?.origin || layoutData?.bus?.route?.origin || "-") +
                " -> " +
                (selectedAssignment?.route?.destination || layoutData?.bus?.route?.destination || "-")}
            </p>
          </div>

          {layoutLoading ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading blueprint...
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              {visibleSeatCount} seats matched
            </span>
          )}
        </div>

        {layoutLoading ? (
          <div className="grid min-h-[260px] place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-300">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching bus blueprint...
            </span>
          </div>
        ) : blueprintDecks.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-300">
            No seat blueprint found for this bus/date.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200">
                Available
              </span>
              <span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-1 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-200">
                Offline Booked
              </span>
              <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-1 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
                Booked
              </span>
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                Locked
              </span>
            </div>

            {blueprintDecks.map((deck, deckIndex) => {
              const deckName = normalizeSeatToken(deck?.deck) || `DECK-${deckIndex + 1}`;
              const rows = Number(deck?.grid?.rows || 0);
              const cols = Number(deck?.grid?.cols || 0);
              const elements = Array.isArray(deck?.elements) ? deck.elements : [];
              const sortedElements = [...elements].sort((first, second) => {
                const firstType = normalizeSeatToken(first?.type) || "GAP";
                const secondType = normalizeSeatToken(second?.type) || "GAP";
                return getElementPriority(firstType) - getElementPriority(secondType);
              });

              if (!rows || !cols) {
                return (
                  <div
                    key={`${deckName}-${deckIndex}`}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200"
                  >
                    Invalid deck grid for {deckName}
                  </div>
                );
              }

              return (
                <section key={`${deckName}-${deckIndex}`} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                      Deck: {deckName}
                    </h2>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {rows} x {cols} grid
                    </span>
                  </div>

                  <div className="overflow-auto rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0f172a]">
                    <div
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${cols}, minmax(44px, 1fr))`,
                        gridAutoRows: "46px",
                      }}
                    >
                      {sortedElements.map((element, index) => {
                        const x = Number(element?.position?.x);
                        const y = Number(element?.position?.y);
                        const w = Number(element?.size?.w || 1);
                        const h = Number(element?.size?.h || 1);

                        if (
                          !Number.isFinite(x) ||
                          !Number.isFinite(y) ||
                          !Number.isFinite(w) ||
                          !Number.isFinite(h)
                        ) {
                          return null;
                        }

                        const type = normalizeSeatToken(element?.type) || "GAP";
                        const seatId = normalizeSeatToken(element?.seatId);

                        if (type === "SEAT" && seatId) {
                          const seat = seatMap.get(seatId);
                          const seatLabel = seat?.label || seatId;
                          const isSelected =
                            normalizeSeatToken(selectedSeatId || "") === seatId;
                          const isMatched =
                            seatSearch.trim() === "" || matchedSeatIds.has(seatId);

                          const statusClass = seat
                            ? getSeatStatusClass(seat)
                            : "border-slate-300 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300";

                          return (
                            <button
                              key={`${deckName}-${seatId}-${index}`}
                              type="button"
                              onClick={() => setSelectedSeatId(seatId)}
                              title={`${seatLabel} • ${seat?.status || "unknown"}`}
                              className={`flex flex-col items-center justify-center rounded-md border text-[10px] font-semibold uppercase tracking-[0.08em] shadow-sm transition ${statusClass} ${
                                isSelected ? "ring-2 ring-indigo-400" : ""
                              } ${seat ? getSeatFlagRingClass(seat) : ""} ${
                                isMatched ? "opacity-100" : "opacity-30"
                              }`}
                              style={{
                                gridColumn: `${x + 1} / span ${Math.max(1, w)}`,
                                gridRow: `${y + 1} / span ${Math.max(1, h)}`,
                              }}
                            >
                              <span className="leading-none">{seatLabel}</span>
                              <span className="mt-1 text-[9px] leading-none opacity-80">
                                {seat?.status || "N/A"}
                              </span>
                            </button>
                          );
                        }

                        const label = type === "GAP" ? "" : getElementLabel(type);
                        return (
                          <div
                            key={`${deckName}-${element?.elementId || `${type}-${index}`}`}
                            className={`flex items-center justify-center rounded-md text-[10px] font-semibold uppercase tracking-[0.08em] ${getElementBaseClass(type)}`}
                            style={{
                              gridColumn: `${x + 1} / span ${Math.max(1, w)}`,
                              gridRow: `${y + 1} / span ${Math.max(1, h)}`,
                            }}
                          >
                            {label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-[#0f172a]">
              {selectedSeat ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Selected Seat
                      </p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {selectedSeat.label} ({selectedSeat.seatId})
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getSeatStatusClass(selectedSeat)}`}
                    >
                      {selectedSeat.status}
                    </span>
                  </div>

                  {selectedSeat.note ? (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      Note: {selectedSeat.note}
                    </p>
                  ) : null}

                  {selectedSeat.flags?.blocked ? (
                    <p className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      This seat is blocked in blueprint.
                    </p>
                  ) : null}

                  <div>
                    {selectedSeat.status === "available" ? (
                      <button
                        type="button"
                        onClick={() => void runSeatAction(selectedSeat.seatId, "book")}
                        disabled={
                          actionSeatKey === selectedActionKey ||
                          selectedSeat.flags?.blocked === true
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
                      >
                        {actionSeatKey === selectedActionKey ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Mark Booked
                      </button>
                    ) : selectedSeat.status === "booked" &&
                      selectedSeat.isOfflineBooked &&
                      selectedSeat.canUndo ? (
                      <button
                        type="button"
                        onClick={() => void runSeatAction(selectedSeat.seatId, "unbook")}
                        disabled={actionSeatKey === selectedActionKey}
                        className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-200"
                      >
                        {actionSeatKey === selectedActionKey ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Undo2 className="h-4 w-4" />
                        )}
                        Undo Offline Booking
                      </button>
                    ) : (
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        {selectedSeat.status === "locked"
                          ? "Seat is temporarily locked by an active booking session."
                          : selectedSeat.isOfflineBooked
                            ? "Seat cannot be undone by this conductor."
                            : "Seat is booked via regular booking flow."}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Select a seat in the blueprint to perform actions.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineSeatManager;
