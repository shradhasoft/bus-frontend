"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Ticket,
  Users,
} from "lucide-react";

import { apiUrl } from "@/lib/api";
import { subscribeBoardingBlueprintChanged } from "@/lib/boarding-events";
import { firebaseAuth } from "@/lib/firebase/client";

type Assignment = {
  _id: string;
  busName?: string;
  busNumber?: string;
  forwardTrip?: {
    departureTime?: {
      hours?: number;
      minutes?: number;
    };
    arrivalTime?: {
      hours?: number;
      minutes?: number;
    };
  };
  returnTrip?: {
    departureTime?: {
      hours?: number;
      minutes?: number;
    };
    arrivalTime?: {
      hours?: number;
      minutes?: number;
    };
  };
  operatingDays?: string[];
  inactiveDates?: string[];
  route?: {
    origin?: string;
    destination?: string;
  };
};

type AutoSelection = {
  assignment: Assignment;
  direction: "forward" | "return";
  isActiveToday: boolean;
  mode: "active-trip" | "upcoming-trip" | "fallback";
  etaMinutes: number | null;
};

type BoardingStatus = "booked" | "boarded";

type BlueprintSeat = {
  status: BoardingStatus;
  passengerName?: string;
  gender?: string;
  age?: number;
  boardingPoint?: string;
  droppingPoint?: string;
  bookingId?: string;
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

type SeatDefinition = {
  seatId?: string;
  label?: string;
  deck?: string;
  position?: {
    x?: number;
    y?: number;
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
  decks?: SeatLayoutDeck[];
  seats?: SeatDefinition[];
};

type BoardingBlueprintPayload = {
  bus?: {
    _id?: string;
    busName?: string;
    busNumber?: string;
    route?: {
      origin?: string;
      destination?: string;
    };
    seatLayout?: SeatLayoutBlueprint | null;
  };
  busId?: string;
  travelDate?: string;
  direction?: "forward" | "return" | "both";
  seats?: Record<string, BlueprintSeat>;
  boardedUsers?: Array<
    BlueprintSeat & {
      seatNumber: string;
    }
  >;
  summary?: {
    totalSeats?: number;
    totalBooked?: number;
    totalBoarded?: number;
    totalPending?: number;
  };
};

const AUTO_REFRESH_MS = 30000;

const normalizeSeatToken = (value?: string | null) =>
  String(value || "")
    .trim()
    .toUpperCase();

const sortSeatNumbers = (first: string, second: string) =>
  first.localeCompare(second, undefined, {
    numeric: true,
    sensitivity: "base",
  });

const formatTravelDate = (value?: string | null) => {
  if (!value) return "Today";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Today";
  return parsed.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const MINUTES_IN_DAY = 24 * 60;

const toMinutes = (time?: { hours?: number; minutes?: number }) => {
  const hours = Number(time?.hours);
  const minutes = Number(time?.minutes);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const isTimeWithinWindow = (
  nowMinutes: number,
  departureMinutes: number | null,
  arrivalMinutes: number | null,
) => {
  if (departureMinutes === null || arrivalMinutes === null) return false;
  if (departureMinutes <= arrivalMinutes) {
    return nowMinutes >= departureMinutes && nowMinutes < arrivalMinutes;
  }
  return nowMinutes >= departureMinutes || nowMinutes < arrivalMinutes;
};

const minutesUntil = (nowMinutes: number, targetMinutes: number | null) => {
  if (targetMinutes === null) return Number.POSITIVE_INFINITY;
  return (targetMinutes - nowMinutes + MINUTES_IN_DAY) % MINUTES_IN_DAY;
};

const formatDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeDayToken = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase();

const isAssignmentActiveToday = (assignment: Assignment, now: Date) => {
  const todayKey = formatDateKey(now);
  const inactiveDates = Array.isArray(assignment.inactiveDates)
    ? assignment.inactiveDates
    : [];
  if (inactiveDates.includes(todayKey)) {
    return false;
  }

  const operatingDays = Array.isArray(assignment.operatingDays)
    ? assignment.operatingDays
    : [];
  if (operatingDays.length === 0) {
    return true;
  }

  const todayName = normalizeDayToken(
    now.toLocaleDateString("en-US", { weekday: "long" }),
  );
  return operatingDays.some((day) => normalizeDayToken(day) === todayName);
};

const resolveDirectionByBusTime = (
  assignment: Assignment,
  now: Date,
): Omit<AutoSelection, "assignment" | "isActiveToday"> => {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const forwardDeparture = toMinutes(assignment.forwardTrip?.departureTime);
  const forwardArrival = toMinutes(assignment.forwardTrip?.arrivalTime);
  const returnDeparture = toMinutes(assignment.returnTrip?.departureTime);
  const returnArrival = toMinutes(assignment.returnTrip?.arrivalTime);

  if (isTimeWithinWindow(nowMinutes, forwardDeparture, forwardArrival)) {
    return {
      direction: "forward",
      mode: "active-trip",
      etaMinutes: 0,
    };
  }

  if (isTimeWithinWindow(nowMinutes, returnDeparture, returnArrival)) {
    return {
      direction: "return",
      mode: "active-trip",
      etaMinutes: 0,
    };
  }

  const forwardEta = minutesUntil(nowMinutes, forwardDeparture);
  const returnEta = minutesUntil(nowMinutes, returnDeparture);

  if (Number.isFinite(forwardEta) && !Number.isFinite(returnEta)) {
    return {
      direction: "forward",
      mode: "upcoming-trip",
      etaMinutes: forwardEta,
    };
  }

  if (!Number.isFinite(forwardEta) && Number.isFinite(returnEta)) {
    return {
      direction: "return",
      mode: "upcoming-trip",
      etaMinutes: returnEta,
    };
  }

  if (!Number.isFinite(forwardEta) && !Number.isFinite(returnEta)) {
    return {
      direction: "forward",
      mode: "fallback",
      etaMinutes: null,
    };
  }

  if (forwardEta <= returnEta) {
    return {
      direction: "forward",
      mode: "upcoming-trip",
      etaMinutes: forwardEta,
    };
  }

  return {
    direction: "return",
    mode: "upcoming-trip",
    etaMinutes: returnEta,
  };
};

const resolveAutoSelection = (assignments: Assignment[], now: Date) => {
  if (assignments.length === 0) return null;

  const ranked = assignments.map((assignment) => {
    const activeToday = isAssignmentActiveToday(assignment, now);
    const directionMeta = resolveDirectionByBusTime(assignment, now);

    return {
      assignment,
      isActiveToday: activeToday,
      direction: directionMeta.direction,
      mode: directionMeta.mode,
      etaMinutes: directionMeta.etaMinutes,
      rankEta:
        typeof directionMeta.etaMinutes === "number"
          ? directionMeta.etaMinutes
          : Number.POSITIVE_INFINITY,
    };
  });

  ranked.sort((first, second) => {
    if (first.isActiveToday !== second.isActiveToday) {
      return first.isActiveToday ? -1 : 1;
    }
    if (first.rankEta !== second.rankEta) {
      return first.rankEta - second.rankEta;
    }

    const firstToken = `${first.assignment.busName || ""} ${first.assignment.busNumber || ""}`.trim();
    const secondToken = `${second.assignment.busName || ""} ${second.assignment.busNumber || ""}`.trim();
    return firstToken.localeCompare(secondToken);
  });

  const winner = ranked[0];
  return {
    assignment: winner.assignment,
    direction: winner.direction,
    isActiveToday: winner.isActiveToday,
    mode: winner.mode,
    etaMinutes: winner.etaMinutes,
  } satisfies AutoSelection;
};

const resolveAutoTravelDate = (selection: AutoSelection | null, now: Date) => {
  if (!selection) {
    return formatDateKey(now);
  }

  const selectedTrip =
    selection.direction === "return"
      ? selection.assignment.returnTrip
      : selection.assignment.forwardTrip;

  const departureMinutes = toMinutes(selectedTrip?.departureTime);
  const arrivalMinutes = toMinutes(selectedTrip?.arrivalTime);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let dayOffset = 0;

  // Upcoming trip whose departure has wrapped to the next day.
  if (
    selection.mode === "upcoming-trip" &&
    departureMinutes !== null &&
    departureMinutes < nowMinutes
  ) {
    dayOffset = 1;
  }

  // Active overnight trip that started yesterday and is still running after midnight.
  if (
    selection.mode === "active-trip" &&
    departureMinutes !== null &&
    arrivalMinutes !== null &&
    departureMinutes > arrivalMinutes &&
    nowMinutes < arrivalMinutes
  ) {
    dayOffset = -1;
  }

  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + dayOffset);
  return formatDateKey(targetDate);
};

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

const getElementClassName = (type: string) => {
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

const getSeatClassName = (status: "available" | "booked" | "boarded") => {
  if (status === "boarded") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200";
  }
  if (status === "booked") {
    return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200";
  }
  return "border-slate-300 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300";
};

const buildFallbackDecksFromSeats = (seats: SeatDefinition[]): SeatLayoutDeck[] => {
  const byDeck = new Map<string, SeatDefinition[]>();

  for (const seat of seats) {
    const deckName = normalizeSeatToken(seat?.deck) || "LOWER";
    const current = byDeck.get(deckName) || [];
    current.push(seat);
    byDeck.set(deckName, current);
  }

  return Array.from(byDeck.entries()).map(([deckName, deckSeats]) => {
    const maxRow = deckSeats.reduce((max, seat) => {
      const y = Number(seat?.position?.y);
      if (!Number.isFinite(y)) return max;
      return Math.max(max, y);
    }, 0);
    const maxCol = deckSeats.reduce((max, seat) => {
      const x = Number(seat?.position?.x);
      if (!Number.isFinite(x)) return max;
      return Math.max(max, x);
    }, 0);

    const elements: SeatLayoutElement[] = deckSeats.map((seat, index) => ({
      elementId: `fallback-${deckName}-${seat.seatId || seat.label || index}`,
      type: "SEAT",
      seatId: normalizeSeatToken(seat?.seatId || seat?.label),
      position: {
        x: Number.isFinite(Number(seat?.position?.x))
          ? Number(seat?.position?.x)
          : index,
        y: Number.isFinite(Number(seat?.position?.y))
          ? Number(seat?.position?.y)
          : 0,
      },
      size: { w: 1, h: 1 },
    }));

    return {
      deck: deckName,
      grid: {
        rows: Math.max(maxRow + 1, 1),
        cols: Math.max(maxCol + 1, 1),
      },
      elements,
    };
  });
};

export default function BoardedUsersBlueprint() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  const [scheduleClockTick, setScheduleClockTick] = useState(() => Date.now());

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BoardingBlueprintPayload | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const autoSelection = useMemo(
    () => resolveAutoSelection(assignments, new Date(scheduleClockTick)),
    [assignments, scheduleClockTick],
  );

  const selectedBusId = autoSelection?.assignment?._id || "";
  const directionFilter = autoSelection?.direction || "forward";
  const resolvedTravelDate = useMemo(
    () => resolveAutoTravelDate(autoSelection, new Date(scheduleClockTick)),
    [autoSelection, scheduleClockTick],
  );

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
    } catch (requestError) {
      setAssignments([]);
      setAssignmentsError(
        (requestError as Error).message || "Unable to load assigned buses.",
      );
    } finally {
      setAssignmentsLoading(false);
    }
  }, [buildHeaders]);

  const loadBlueprint = useCallback(
    async (options?: { background?: boolean }) => {
      if (!selectedBusId) {
        setData(null);
        return;
      }

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
        params.set("busId", selectedBusId);
        params.set("direction", directionFilter);
        params.set("travelDate", resolvedTravelDate);

        const response = await fetch(
          apiUrl(`/boarding-blueprint?${params.toString()}`),
          {
            method: "GET",
            credentials: "include",
            headers,
            cache: "no-store",
          },
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to fetch boarding blueprint.");
        }

        setData(payload?.data || null);
        setLastUpdatedAt(new Date().toISOString());
      } catch (requestError) {
        setError(
          (requestError as Error).message ||
            "Unable to fetch boarding blueprint.",
        );
      } finally {
        if (isBackgroundRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [buildHeaders, directionFilter, resolvedTravelDate, selectedBusId],
  );

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadAssignments();
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadAssignments]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setScheduleClockTick(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    void loadBlueprint();
  }, [loadBlueprint]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadBlueprint({ background: true });
    }, AUTO_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [loadBlueprint]);

  useEffect(() => {
    const handleFocus = () => {
      void loadBlueprint({ background: true });
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadBlueprint]);

  useEffect(() => {
    return subscribeBoardingBlueprintChanged(() => {
      void loadBlueprint({ background: true });
    });
  }, [loadBlueprint]);

  const activeAssignment = autoSelection?.assignment || null;

  const seatEntries = useMemo(() => {
    return Object.entries(data?.seats || {}).sort((first, second) =>
      sortSeatNumbers(first[0], second[0]),
    );
  }, [data?.seats]);

  const seatStatusMap = useMemo(() => {
    const map = new Map<string, BlueprintSeat>();
    for (const [seatNumber, details] of seatEntries) {
      map.set(normalizeSeatToken(seatNumber), details);
    }
    return map;
  }, [seatEntries]);

  const seatDefinitions = useMemo(() => {
    const rows = Array.isArray(data?.bus?.seatLayout?.seats)
      ? data?.bus?.seatLayout?.seats
      : [];
    return rows;
  }, [data?.bus?.seatLayout?.seats]);

  const seatDefinitionById = useMemo(() => {
    const map = new Map<string, SeatDefinition>();
    for (const seat of seatDefinitions) {
      const key = normalizeSeatToken(seat?.seatId);
      if (!key) continue;
      map.set(key, seat);
    }
    return map;
  }, [seatDefinitions]);

  const resolveSeatStatus = useCallback(
    (seatId: string) => {
      const normalizedSeatId = normalizeSeatToken(seatId);
      if (!normalizedSeatId) return null;

      const direct = seatStatusMap.get(normalizedSeatId);
      if (direct) {
        return {
          details: direct,
          seatLabel:
            seatDefinitionById.get(normalizedSeatId)?.label || normalizedSeatId,
        };
      }

      const seatDefinition = seatDefinitionById.get(normalizedSeatId);
      const mappedByLabel = seatStatusMap.get(
        normalizeSeatToken(seatDefinition?.label),
      );

      if (mappedByLabel) {
        return {
          details: mappedByLabel,
          seatLabel: seatDefinition?.label || normalizedSeatId,
        };
      }

      return null;
    },
    [seatDefinitionById, seatStatusMap],
  );

  const blueprintDecks = useMemo(() => {
    const decks = Array.isArray(data?.bus?.seatLayout?.decks)
      ? data.bus?.seatLayout?.decks
      : [];

    if (decks.length > 0) {
      return decks;
    }

    return buildFallbackDecksFromSeats(seatDefinitions);
  }, [data?.bus?.seatLayout?.decks, seatDefinitions]);

  const boardedUsers = useMemo(() => {
    const existingRows = Array.isArray(data?.boardedUsers) ? data.boardedUsers : [];
    if (existingRows.length > 0) {
      return [...existingRows].sort((first, second) =>
        sortSeatNumbers(first.seatNumber, second.seatNumber),
      );
    }

    return seatEntries
      .filter(([, details]) => details.status === "boarded")
      .map(([seatNumber, details]) => ({
        seatNumber,
        ...details,
      }));
  }, [data?.boardedUsers, seatEntries]);

  const summary = data?.summary || {};
  const totalSeats = summary.totalSeats ?? seatDefinitions.length;
  const totalBooked = summary.totalBooked ?? seatEntries.length;
  const totalBoarded = summary.totalBoarded ?? boardedUsers.length;
  const totalPending = summary.totalPending ?? Math.max(totalBooked - totalBoarded, 0);

  const directionLabel = autoSelection
    ? directionFilter === "return"
      ? "Return"
      : "Forward"
    : "-";
  const assignedBusLabel = activeAssignment
    ? `${activeAssignment.busName || "Unnamed bus"} (${activeAssignment.busNumber || "-"})`
    : assignmentsLoading
      ? "Resolving assigned bus..."
      : "No assigned bus";

  const directionHint = !autoSelection
    ? "Direction unavailable."
    : autoSelection.mode === "active-trip"
      ? "Direction auto-detected from current trip timing."
      : autoSelection.mode === "upcoming-trip"
        ? `Auto-switched by next trip in ${autoSelection.etaMinutes ?? 0} min.`
        : "Schedule time not found, defaulting to Forward.";

  const assignmentHint = !autoSelection
    ? "No active conductor assignment found."
    : autoSelection.isActiveToday
      ? "Auto-selected from today's active assignment."
      : "Auto-selected from closest assigned bus schedule.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Conductor Ops
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Boarded Users
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Today&apos;s seat blueprint with live boarded status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadAssignments();
            void loadBlueprint({ background: true });
          }}
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

      <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900/70 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Assigned Bus
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {assignedBusLabel}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {assignmentHint}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Direction
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {directionLabel}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {directionHint}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Travel Date
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {formatTravelDate(data?.travelDate || resolvedTravelDate)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Last Sync
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString("en-IN") : "-"}
          </p>
        </div>
      </div>

      {assignmentsError ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{assignmentsError}</span>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {!selectedBusId && !assignmentsLoading ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-8 text-center text-sm font-medium text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          No buses assigned for today.
        </div>
      ) : null}

      {selectedBusId ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Total Seats
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {totalSeats}
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50 px-4 py-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                Booked Today
              </p>
              <p className="mt-2 text-2xl font-bold text-indigo-700 dark:text-indigo-200">
                {totalBooked}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">
                Boarded
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-200">
                {totalBoarded}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                Pending
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-200">
                {totalPending}
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {activeAssignment?.busName || data?.bus?.busName || "Assigned Bus"}
                  </p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                    {(activeAssignment?.route?.origin || data?.bus?.route?.origin || "-") +
                      " -> " +
                      (activeAssignment?.route?.destination ||
                        data?.bus?.route?.destination ||
                        "-")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200">
                    Boarded
                  </span>
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                    Booked
                  </span>
                  <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    Available
                  </span>
                </div>
              </div>

              {loading ? (
                <div className="grid min-h-[300px] place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading blueprint...
                  </span>
                </div>
              ) : blueprintDecks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-300">
                  Seat blueprint is not available for this bus.
                </div>
              ) : (
                <div className="space-y-6">
                  {blueprintDecks.map((deck, index) => {
                    const deckName = normalizeSeatToken(deck?.deck) || `DECK-${index + 1}`;
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
                          key={`${deckName}-${index}`}
                          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200"
                        >
                          Invalid deck grid for {deckName}.
                        </div>
                      );
                    }

                    return (
                      <section key={`${deckName}-${index}`} className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                          <p className="font-semibold uppercase tracking-[0.2em]">
                            Deck: {deckName}
                          </p>
                          <span>
                            {rows} x {cols}
                          </span>
                        </div>

                        <div className="overflow-auto rounded-2xl border border-slate-200/80 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0f172a]">
                          <div
                            className="grid gap-1"
                            style={{
                              gridTemplateColumns: `repeat(${cols}, minmax(42px, 1fr))`,
                              gridAutoRows: "44px",
                            }}
                          >
                            {sortedElements.map((element, elementIndex) => {
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
                                const seatMeta = seatDefinitionById.get(seatId);
                                const seatData = resolveSeatStatus(seatId);
                                const resolvedStatus = seatData?.details?.status || "available";
                                const seatLabel = seatMeta?.label || seatData?.seatLabel || seatId;
                                const passengerName = seatData?.details?.passengerName || "";

                                return (
                                  <div
                                    key={`${deckName}-${seatId}-${elementIndex}`}
                                    className={`relative flex items-center justify-center rounded-md border text-[11px] font-semibold transition ${getSeatClassName(
                                      resolvedStatus,
                                    )}`}
                                    style={{
                                      gridColumn: `${x + 1} / span ${Math.max(w, 1)}`,
                                      gridRow: `${y + 1} / span ${Math.max(h, 1)}`,
                                    }}
                                    title={
                                      passengerName
                                        ? `${seatLabel}: ${passengerName} (${resolvedStatus})`
                                        : `${seatLabel}: ${resolvedStatus}`
                                    }
                                  >
                                    <span className="truncate px-1">{seatLabel}</span>
                                    {resolvedStatus === "boarded" ? (
                                      <CheckCircle2 className="absolute right-0.5 top-0.5 h-3 w-3 text-emerald-600 dark:text-emerald-300" />
                                    ) : null}
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={`${deckName}-${type}-${elementIndex}`}
                                  className={`flex items-center justify-center rounded-md border text-[10px] font-semibold uppercase tracking-[0.08em] ${getElementClassName(
                                    type,
                                  )}`}
                                  style={{
                                    gridColumn: `${x + 1} / span ${Math.max(w, 1)}`,
                                    gridRow: `${y + 1} / span ${Math.max(h, 1)}`,
                                  }}
                                >
                                  {getElementLabel(type)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="space-y-3">
              <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Boarded Passenger List
                </p>
                <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  <Users className="h-5 w-5 text-emerald-500" />
                  {totalBoarded}
                </p>
              </div>

              <div className="max-h-[540px] overflow-auto rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                {boardedUsers.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-300">
                    No boarded users yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {boardedUsers.map((user) => (
                      <div
                        key={`${user.seatNumber}-${user.bookingId || user.passengerName || "boarded"}`}
                        className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                              {user.passengerName || "Passenger"}
                            </p>
                            <p className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-200/80">
                              {user.boardingPoint || "-"} {"->"} {user.droppingPoint || "-"}
                            </p>
                          </div>
                          <span className="inline-flex items-center rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                            {user.seatNumber}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-3 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
                <p className="flex items-center gap-1.5 font-semibold uppercase tracking-[0.16em]">
                  <Ticket className="h-3.5 w-3.5" />
                  Auto Refresh
                </p>
                <p className="mt-1">Blueprint syncs every 30 seconds and after each boarding update.</p>
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
