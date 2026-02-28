"use client";

import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  Bus,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  QrCode,
  Search,
  Ticket,
  User,
  XCircle,
} from "lucide-react";
import {
  Html5QrcodeScanType,
  Html5QrcodeScanner,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/api";
import { dispatchBoardingBlueprintChangedEvent } from "@/lib/boarding-events";
import { cn } from "@/lib/utils";

type TicketData = {
  bookingId: string;
  travelDate: string;
  boardingPoint: string;
  droppingPoint: string;
  direction: string;
  status: "upcoming" | "completed" | "cancelled";
  paymentStatus: string;
  passengers: Array<{
    name: string;
    age?: number;
    gender?: string;
    seatNumber: string;
  }>;
  busLabel: string;
  operator: string;
  bookedBy: string;
  createdAt: string;
};

const extractBookingRefFromScan = (decodedText: string) => {
  const raw = decodedText.trim();
  if (!raw) return "";

  try {
    const parsedUrl = new URL(raw);
    const queryRef =
      parsedUrl.searchParams.get("bookingId") ||
      parsedUrl.searchParams.get("bookingRef");
    if (queryRef?.trim()) {
      return decodeURIComponent(queryRef.trim());
    }
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    const lastPathToken = pathParts[pathParts.length - 1] || "";
    return decodeURIComponent(lastPathToken.trim());
  } catch {
    const normalized = raw.replace(/^bookmyseat:\/\//i, "");
    const keyedMatch = normalized.match(
      /(?:bookingId|bookingRef)\s*[:=]\s*([A-Za-z0-9-]+)/i,
    );
    if (keyedMatch?.[1]) return keyedMatch[1].trim();

    const pathParts = normalized.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1].trim();
    }
    return normalized;
  }
};

export default function VerifyTicketPage() {
  const [bookingRef, setBookingRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [activeTab, setActiveTab] = useState<"scan" | "manual">("scan");

  // Boarding action state
  const [boardingLoading, setBoardingLoading] = useState(false);
  const [boardingError, setBoardingError] = useState<string | null>(null);
  const [boardingSuccess, setBoardingSuccess] = useState(false);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scanRequestInFlightRef = useRef(false);

  const fetchTicket = React.useCallback(
    async (ref: string) => {
      const sanitizedRef = ref.trim();
      if (!sanitizedRef) return;
      setLoading(true);
      setError(null);
      setTicket(null);
      setBoardingSuccess(false);
      setBoardingError(null);

      try {
        const response = await fetch(
          apiUrl(`/verify-ticket/${encodeURIComponent(sanitizedRef)}`),
          {
            credentials: "include",
          },
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Failed to verify ticket.");
        }

        setTicket(result.data);
        if (activeTab === "scan" && scannerRef.current) {
          try {
            scannerRef.current.pause(true); // Pause scanning once successful
          } catch (e) {
            // Ignore error if pause fails (e.g. if the scanner is not yet fully running)
            console.warn(e);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message || "An unexpected error occurred.");
        } else {
          setError("An unexpected error occurred.");
        }
      } finally {
        setLoading(false);
      }
    },
    [activeTab],
  );

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTicket(bookingRef);
  };

  const markAsBoarded = async () => {
    if (!ticket) return;
    setBoardingLoading(true);
    setBoardingError(null);

    try {
      const response = await fetch(
        apiUrl(`/verify-ticket/${ticket.bookingId}/board`),
        {
          method: "POST",
          credentials: "include", // Needs auth as conductor
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to mark as boarded.");
      }

      setBoardingSuccess(true);
      setTicket((prev) => (prev ? { ...prev, status: "completed" } : prev));
      dispatchBoardingBlueprintChangedEvent();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setBoardingError(err.message || "An unexpected error occurred.");
      } else {
        setBoardingError("An unexpected error occurred.");
      }
    } finally {
      setBoardingLoading(false);
    }
  };

  // Initialize QR Scanner when on "scan" tab
  useEffect(() => {
    if (activeTab === "scan") {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
          useBarCodeDetectorIfSupported: true,
          supportedScanTypes: [
            Html5QrcodeScanType.SCAN_TYPE_CAMERA,
            Html5QrcodeScanType.SCAN_TYPE_FILE,
          ],
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        },
        false,
      );
      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          if (scanRequestInFlightRef.current) return;

          const extractedRef = extractBookingRefFromScan(decodedText);
          if (!extractedRef) return;

          scanRequestInFlightRef.current = true;
          setBookingRef(extractedRef);
          void fetchTicket(extractedRef).finally(() => {
            scanRequestInFlightRef.current = false;
          });
        },
        (errorMessage) => {
          // Ignore frequent "no code found" errors while scanning.
          if (
            errorMessage.includes(
              "No MultiFormat Readers were able to detect the code",
            )
          ) {
            return;
          }

          // Keep scanner running for intermittent camera/file decode errors.
        },
      );

      return () => {
        scanRequestInFlightRef.current = false;
        scanner.clear().catch(console.error);
        scannerRef.current = null;
      };
    }
  }, [activeTab, fetchTicket]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Verify Ticket
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Scan a QR code or enter a Booking ID to quickly verify a
          passenger&apos;s digital ticket and mark them as boarded.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 items-start">
        {/* Input Section */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#0f172a]">
          <div className="flex w-full mb-6 rounded-lg bg-slate-100 p-1 dark:bg-slate-800/50">
            <button
              className={cn(
                "flex-1 rounded-md py-2 text-sm font-semibold transition-all",
                activeTab === "scan"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
              )}
              onClick={() => {
                setActiveTab("scan");
                setTicket(null);
                setBookingRef("");
                setError(null);
              }}
            >
              Scan QR
            </button>
            <button
              className={cn(
                "flex-1 rounded-md py-2 text-sm font-semibold transition-all",
                activeTab === "manual"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
              )}
              onClick={() => {
                setActiveTab("manual");
                setTicket(null);
                setError(null);
              }}
            >
              Manual Entry
            </button>
          </div>

          {activeTab === "scan" ? (
            <div className="space-y-3">
              <div className="w-full relative min-h-[300px] flex items-center justify-center rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-white/10">
                <div id="qr-reader" className="w-full h-full border-none!" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                If image scan fails, upload a tightly-cropped QR image with a
                white border, or switch to manual booking ID entry.
              </p>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="bookingId"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Booking ID or Phone
                </label>
                <div className="relative">
                  <Input
                    id="bookingId"
                    type="text"
                    value={bookingRef}
                    onChange={(e) => setBookingRef(e.target.value)}
                    placeholder="e.g. BK-2024..."
                    className="h-12 pl-12 rounded-xl text-lg font-medium tracking-wide dark:bg-slate-900/50 dark:border-white/10"
                    disabled={loading}
                    required
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading || !bookingRef}
                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : null}
                Verify Now
              </Button>
            </form>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400">
              <XCircle className="h-5 w-5 fill-rose-100 dark:fill-rose-900/30 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Result Section */}
        <div className="flex flex-col gap-6">
          {ticket ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40 p-6 overflow-hidden relative dark:border-white/10 dark:bg-slate-900 dark:shadow-none">
              {ticket.status === "cancelled" ? (
                <div className="absolute top-0 right-0 bg-rose-500 text-white px-4 py-1.5 text-xs font-bold tracking-widest uppercase rounded-bl-3xl">
                  Cancelled
                </div>
              ) : ticket.status === "completed" ? (
                <div className="absolute top-0 right-0 bg-slate-500 text-white px-4 py-1.5 text-xs font-bold tracking-widest uppercase rounded-bl-3xl">
                  Used / Boarded
                </div>
              ) : null}

              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl p-6 text-center text-white shadow-inner mb-6 transition-colors duration-500",
                  ticket.status === "upcoming"
                    ? "bg-emerald-500 shadow-emerald-500/20"
                    : ticket.status === "completed"
                      ? "bg-slate-600 shadow-slate-600/20"
                      : "bg-rose-500 shadow-rose-500/20",
                )}
              >
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                  {ticket.status === "upcoming" ? (
                    <CheckCircle2 className="h-8 w-8 text-white" />
                  ) : ticket.status === "completed" ? (
                    <Clock className="h-8 w-8 text-white" />
                  ) : (
                    <XCircle className="h-8 w-8 text-white" />
                  )}
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {ticket.status === "upcoming"
                    ? "Valid Ticket"
                    : ticket.status === "completed"
                      ? "Already Scanned"
                      : "Invalid / Cancelled"}
                </h2>
                <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-medium text-white/90">
                  <QrCode className="h-4 w-4" />
                  {ticket.bookingId}
                </p>
              </div>

              <div className="space-y-6">
                {/* Journey details */}
                <div className="border-b border-dashed border-slate-200 pb-5 dark:border-white/10">
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
                    <MapPin className="h-3.5 w-3.5" /> Route
                  </p>
                  <div className="flex items-center gap-3 text-lg font-bold text-slate-800 dark:text-slate-100">
                    <span>{ticket.boardingPoint}</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                    <span>{ticket.droppingPoint}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {ticket.travelDate
                      ? format(new Date(ticket.travelDate), "EEEE, d MMM yyyy")
                      : "N/A"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-dashed border-slate-200 pb-5 dark:border-white/10">
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <Bus className="h-3 w-3" /> Bus
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {ticket.busLabel}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {ticket.operator}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <User className="h-3 w-3" /> Booked By
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {ticket.bookedBy}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {ticket.createdAt
                        ? format(new Date(ticket.createdAt), "d MMM, HH:mm")
                        : ""}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Passengers ({ticket.passengers.length})
                  </p>
                  <div className="space-y-2">
                    {ticket.passengers.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {p.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.age} Yrs • {p.gender}
                          </p>
                        </div>
                        <div className="rounded-lg bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                          Seat {p.seatNumber}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mark as board action */}
              {ticket.status === "upcoming" && (
                <div className="mt-6 border-t border-slate-100 pt-6 dark:border-white/10">
                  <Button
                    onClick={markAsBoarded}
                    disabled={boardingLoading}
                    className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-500/20"
                  >
                    {boardingLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                    )}
                    Mark as Boarded
                  </Button>

                  {boardingError && (
                    <p className="text-xs text-rose-500 mt-2 text-center">
                      {boardingError}
                    </p>
                  )}
                  {boardingSuccess && (
                    <p className="text-xs text-emerald-500 mt-2 text-center font-medium">
                      Boarding successful! Status updated.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center dark:border-white/10 dark:bg-white/5">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-400">
                <Ticket className="h-8 w-8" />
              </div>
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                Awaiting Scan
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-[250px]">
                Scan a digital ticket QR code or manually enter the booking ID
                to see the details here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
