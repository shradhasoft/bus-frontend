"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Ticket,
  XCircle,
  MapPin,
  Bus,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { format } from "date-fns";

type TicketData = {
  bookingId: string;
  travelDate: string;
  boardingPoint: string;
  droppingPoint: string;
  direction: string;
  status: string;
  paymentStatus: string;
  passengers: {
    name: string;
    age: number;
    gender: string;
    seatNumber: string;
  }[];
  busLabel: string;
  operator: string;
  bookedBy: string;
  createdAt: string;
};

export default function TicketVerificationPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.bookingId as string;

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;

    const verifyTicket = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(apiUrl(`/verify-ticket/${bookingId}`));
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || "Unable to verify ticket.");
        }

        setTicket(payload.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error validating ticket.",
        );
      } finally {
        setLoading(false);
      }
    };

    verifyTicket();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500 dark:border-slate-800 dark:border-t-sky-400" />
        <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
          Verifying ticket...
        </p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="rounded-full bg-rose-100 p-4 dark:bg-rose-900/30">
          <XCircle className="h-10 w-10 text-rose-600 dark:text-rose-400" />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
          Invalid Ticket
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-sm">
          {error || "This ticket could not be found or verified."}
        </p>
        <Button asChild className="mt-8 rounded-full" variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go to home
          </Link>
        </Button>
      </div>
    );
  }

  // Determine styles by status
  const isUpcoming = ticket.status === "upcoming";
  const isCompleted = ticket.status === "completed";
  const isCancelled = ticket.status === "cancelled";

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-950 px-4 pb-8 pt-24 sm:px-12 sm:pb-12 sm:pt-32 font-sans">
      <div className="mx-auto max-w-lg">
        {/* Top Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/")}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-sky-500" />
            <span className="font-bold tracking-tight text-slate-900 dark:text-white">
              BookMySeat Ticket
            </span>
          </div>
        </div>

        {/* Status Card */}
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/50 dark:bg-slate-900 dark:shadow-none border border-slate-100 dark:border-white/5">
          {/* Header Banner */}
          <div
            className={cn(
              "px-6 py-8 text-center",
              isUpcoming && "bg-emerald-500",
              isCompleted && "bg-slate-700",
              isCancelled && "bg-rose-500",
            )}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md mb-4 shadow-sm">
              {isUpcoming && <CheckCircle2 className="h-8 w-8 text-white" />}
              {isCompleted && (
                <CheckCircle2 className="h-8 w-8 text-white opacity-80" />
              )}
              {isCancelled && <XCircle className="h-8 w-8 text-white" />}
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {isUpcoming && "Valid Ticket"}
              {isCompleted && "Trip Completed"}
              {isCancelled && "Cancelled Ticket"}
            </h2>
            <p className="mt-1 text-sm font-medium text-white/80">
              Booking ID: {ticket.bookingId}
            </p>
          </div>

          <div className="px-6 py-6 pb-8 space-y-6">
            {/* Route */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Route
                </span>
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                {ticket.boardingPoint}
                <ArrowLeft className="h-4 w-4 text-slate-300 dark:text-slate-600 rotate-180" />
                {ticket.droppingPoint}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
                {format(new Date(ticket.travelDate), "EEEE, dd MMM yyyy")}
              </p>
            </div>

            <div className="h-px w-full border-t border-dashed border-slate-200 dark:border-slate-800" />

            {/* Bus Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Bus className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Bus
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {ticket.busLabel}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {ticket.operator}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Booked By
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {ticket.bookedBy}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {format(new Date(ticket.createdAt), "dd MMM, HH:mm")}
                </p>
              </div>
            </div>

            <div className="h-px w-full border-t border-dashed border-slate-200 dark:border-slate-800" />

            {/* Passengers */}
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 block">
                Passengers ({ticket.passengers.length})
              </span>
              <div className="space-y-3">
                {ticket.passengers.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {p.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                        {p.age} yrs • {p.gender}
                      </p>
                    </div>
                    <div className="rounded-lg bg-emerald-100 px-3 py-1 dark:bg-emerald-900/30">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        Seat {p.seatNumber}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timestamp */}
            <div className="text-center pt-4">
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 border border-slate-200 dark:border-slate-800 inline-block px-3 py-1.5 rounded-full">
                Verified On: {format(new Date(), "dd MMM yyyy, HH:mm:ss")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
