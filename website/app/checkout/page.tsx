"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

type PassengerForm = {
  seatNumber: string;
  name: string;
  age: string;
  gender: "male" | "female" | "other";
  mobileNumber: string;
  identificationType: "aadhar" | "passport" | "dl";
  identificationNumber: string;
};

type BookingState = {
  bookingId: string;
  paymentId: string;
};

type OfferPreviewState = {
  code: string;
  pricing: {
    baseAmount: number;
    discountAmount: number;
    finalAmount: number;
    currency?: string;
  };
  offerSnapshot?: {
    title?: string | null;
    code?: string | null;
  } | null;
};

type OfferPreviewResponse = {
  success?: boolean;
  eligible?: boolean;
  reason?: string;
  code?: string;
  pricing?: {
    baseAmount?: number;
    discountAmount?: number;
    finalAmount?: number;
    currency?: string;
  };
  offerSnapshot?: {
    title?: string | null;
    code?: string | null;
  } | null;
};

type RazorpayPaymentFailure = {
  error?: {
    description?: string;
  };
};

type RazorpayInstance = {
  open: () => void;
  on: (
    event: "payment.failed",
    handler: (response: RazorpayPaymentFailure) => void,
  ) => void;
};

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const formatFare = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `₹${new Intl.NumberFormat("en-IN").format(Math.round(value))}`;
};

const formatDateLabel = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const generateSessionId = () => {
  if (typeof window !== "undefined") {
    if (typeof window.crypto?.randomUUID === "function") {
      return `session_${window.crypto.randomUUID()}`;
    }
    if (typeof window.crypto?.getRandomValues === "function") {
      const bytes = new Uint8Array(12);
      window.crypto.getRandomValues(bytes);
      const token = Array.from(bytes)
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
      return `session_${token}`;
    }
  }
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const CheckoutPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const seatParam = searchParams.get("seats") ?? "";
  const seats = useMemo(
    () =>
      seatParam
        .split(",")
        .map((seat) => seat.trim())
        .filter(Boolean),
    [seatParam],
  );
  const seatKey = useMemo(
    () => seats.slice().sort().join("-"),
    [seats],
  );

  const busId = searchParams.get("busId") ?? "";
  const travelDate = searchParams.get("travelDate") ?? "";
  const direction =
    searchParams.get("direction") === "return" ? "return" : "forward";
  const boardingPoint = searchParams.get("boardingPoint") ?? "";
  const droppingPoint = searchParams.get("droppingPoint") ?? "";
  const busName = searchParams.get("busName") ?? "Bus Service";
  const operatorName = searchParams.get("operator") ?? "Operator";

  const fareValue = Number.parseFloat(searchParams.get("fare") ?? "");
  const farePerPassenger = Number.isFinite(fareValue) ? fareValue : null;
  const totalFare =
    farePerPassenger !== null ? farePerPassenger * seats.length : null;

  const [passengers, setPassengers] = useState<PassengerForm[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState<BookingState | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedOffer, setAppliedOffer] = useState<OfferPreviewState | null>(
    null,
  );

  const baseFareAmount =
    typeof appliedOffer?.pricing.baseAmount === "number"
      ? appliedOffer.pricing.baseAmount
      : totalFare;
  const discountAmount =
    typeof appliedOffer?.pricing.discountAmount === "number"
      ? appliedOffer.pricing.discountAmount
      : 0;
  const finalPayable =
    typeof appliedOffer?.pricing.finalAmount === "number"
      ? appliedOffer.pricing.finalAmount
      : totalFare;

  useEffect(() => {
    if (!busId || !travelDate) return;
    const key = `checkout_session_${busId}_${travelDate}_${direction}_${boardingPoint}_${droppingPoint}_${seatKey}`;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      setSessionId(stored);
      return;
    }
    const fresh = generateSessionId();
    sessionStorage.setItem(key, fresh);
    setSessionId(fresh);
  }, [busId, travelDate, direction, boardingPoint, droppingPoint, seatKey]);

  useEffect(() => {
    setPassengers((prev) =>
      seats.map((seat) => {
        const existing = prev.find((item) => item.seatNumber === seat);
        return (
          existing ?? {
            seatNumber: seat,
            name: "",
            age: "",
            gender: "male",
            mobileNumber: "",
            identificationType: "aadhar",
            identificationNumber: "",
          }
        );
      }),
    );
  }, [seats]);

  useEffect(() => {
    setAppliedOffer(null);
    setPromoError(null);
  }, [busId, travelDate, boardingPoint, droppingPoint, direction, seatKey]);

  const updatePassenger = (index: number, updates: Partial<PassengerForm>) => {
    setPassengers((prev) =>
      prev.map((passenger, idx) =>
        idx === index ? { ...passenger, ...updates } : passenger,
      ),
    );
  };

  const validatePassengers = () => {
    if (!passengers.length) {
      return "Add passenger details to continue.";
    }
    if (passengers.length !== seats.length) {
      return "Passenger count must match selected seats.";
    }
    for (const passenger of passengers) {
      if (!passenger.name || passenger.name.trim().length < 2) {
        return `Enter a valid name for seat ${passenger.seatNumber}.`;
      }
      const ageValue = Number.parseInt(passenger.age, 10);
      if (!Number.isFinite(ageValue) || ageValue < 1 || ageValue > 120) {
        return `Enter a valid age for seat ${passenger.seatNumber}.`;
      }
      if (!passenger.gender) {
        return `Select a gender for seat ${passenger.seatNumber}.`;
      }
      if (!/^[6-9]\d{9}$/.test(passenger.mobileNumber)) {
        return `Enter a valid mobile number for seat ${passenger.seatNumber}.`;
      }
      if (!passenger.identificationType) {
        return `Select an ID type for seat ${passenger.seatNumber}.`;
      }
      if (
        !passenger.identificationNumber ||
        passenger.identificationNumber.trim().length < 8
      ) {
        return `Enter a valid ID number for seat ${passenger.seatNumber}.`;
      }
    }
    return null;
  };

  const handleApplyOffer = async () => {
    setError(null);
    setPromoError(null);
    setRequiresLogin(false);

    const normalizedCode = promoCode.trim().toUpperCase();
    if (!normalizedCode) {
      setPromoError("Enter a promo code.");
      return;
    }

    if (!busId || !travelDate || seats.length === 0) {
      setPromoError("Booking details are incomplete.");
      return;
    }

    setPromoLoading(true);
    try {
      const response = await fetch(apiUrl("/offers/preview"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: normalizedCode,
          busId,
          travelDate,
          boardingPoint,
          droppingPoint,
          passengerCount: seats.length,
          direction,
        }),
      });

      if (response.status === 401) {
        setRequiresLogin(true);
      }

      const payload = (await response
        .json()
        .catch(() => ({}))) as OfferPreviewResponse;

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Sign in to apply offers.");
        }
        throw new Error(payload.reason || payload.code || "Unable to apply offer.");
      }

      if (!payload.eligible || !payload.pricing) {
        setAppliedOffer(null);
        setPromoError(payload.reason || "Offer is not applicable.");
        return;
      }

      setAppliedOffer({
        code: normalizedCode,
        pricing: {
          baseAmount: Number(payload.pricing.baseAmount || 0),
          discountAmount: Number(payload.pricing.discountAmount || 0),
          finalAmount: Number(payload.pricing.finalAmount || 0),
          currency: payload.pricing.currency || "INR",
        },
        offerSnapshot: payload.offerSnapshot || null,
      });
      setPromoCode(normalizedCode);
    } catch (offerError) {
      setAppliedOffer(null);
      setPromoError(
        offerError instanceof Error
          ? offerError.message
          : "Unable to apply promo code.",
      );
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemoveOffer = () => {
    setAppliedOffer(null);
    setPromoError(null);
    setPromoCode("");
  };

  const handleCheckout = async () => {
    setError(null);
    setRequiresLogin(false);

    if (!busId || !travelDate || seats.length === 0) {
      setError("Missing booking details. Please go back and select seats.");
      return;
    }

    if (!sessionId) {
      setError("Session expired. Please refresh and try again.");
      return;
    }

    const validationError = validatePassengers();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const lockResponse = await fetch(apiUrl("/lock-seats"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          busId,
          travelDate,
          seatNumbers: seats,
          sessionId,
          direction,
          boardingPoint,
          droppingPoint,
        }),
      });

      if (lockResponse.status === 401) {
        setRequiresLogin(true);
      }

      const lockPayload = await lockResponse.json().catch(() => ({}));
      if (!lockResponse.ok) {
        throw new Error(
          lockPayload?.message || "Unable to lock seats. Please retry.",
        );
      }

      const activeSessionId =
        lockPayload?.data?.sessionId || lockPayload?.sessionId || sessionId;

      if (activeSessionId && activeSessionId !== sessionId) {
        const key = `checkout_session_${busId}_${travelDate}_${direction}_${boardingPoint}_${droppingPoint}_${seatKey}`;
        sessionStorage.setItem(key, activeSessionId);
        setSessionId(activeSessionId);
      }

      const bookingResponse = await fetch(apiUrl("/create-booking"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          busId,
          travelDate,
          passengers: passengers.map((passenger) => ({
            name: passenger.name.trim(),
            age: Number.parseInt(passenger.age, 10),
            gender: passenger.gender,
            seatNumber: passenger.seatNumber,
            mobileNumber: passenger.mobileNumber.trim(),
            identification: {
              type: passenger.identificationType,
              number: passenger.identificationNumber.trim(),
            },
          })),
          boardingPoint,
          droppingPoint,
          sessionId: activeSessionId,
          direction,
          offerCode: appliedOffer?.code || undefined,
        }),
      });

      if (bookingResponse.status === 401) {
        setRequiresLogin(true);
      }

      const bookingPayload = await bookingResponse.json().catch(() => ({}));
      if (!bookingResponse.ok) {
        throw new Error(
          bookingPayload?.message ||
            "Unable to create booking. Please retry.",
        );
      }

      const bookingId = bookingPayload?.data?._id || bookingPayload?.data?.id;
      if (!bookingId) {
        throw new Error("Booking could not be created.");
      }

      const orderResponse = await fetch(apiUrl("/create-order"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });

      const orderPayload = await orderResponse.json().catch(() => ({}));
      if (!orderResponse.ok) {
        throw new Error(
          orderPayload?.message || "Unable to create payment order.",
        );
      }

      const scriptLoaded = await loadRazorpay();
      if (!scriptLoaded) {
        throw new Error("Razorpay SDK failed to load. Please retry.");
      }

      const order = orderPayload?.order;
      const paymentId = orderPayload?.paymentId;
      const keyId = orderPayload?.keyId;

      if (!order || !paymentId || !keyId) {
        throw new Error("Invalid payment order response.");
      }

      const primaryPassenger = passengers[0];

      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency || "INR",
        name: busName,
        description: `${boardingPoint} to ${droppingPoint}`,
        order_id: order.id,
        prefill: {
          name: primaryPassenger?.name || undefined,
          contact: primaryPassenger?.mobileNumber || undefined,
        },
        notes: {
          bookingId,
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          setVerifying(true);
          try {
            const verifyResponse = await fetch(
              apiUrl(`/verify/${paymentId}`),
              {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response),
              },
            );

            const verifyPayload = await verifyResponse
              .json()
              .catch(() => ({}));

            if (!verifyResponse.ok) {
              throw new Error(
                verifyPayload?.message ||
                  "Payment verification failed. Contact support.",
              );
            }

            setSuccess({ bookingId, paymentId });
          } catch (verifyError) {
            setError(
              verifyError instanceof Error
                ? verifyError.message
                : "Payment verification failed.",
            );
          } finally {
            setVerifying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        theme: {
          color: "#e11d48",
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", (response: RazorpayPaymentFailure) => {
        const reason = response?.error?.description || "Payment failed.";
        setError(reason);
      });
      razorpay.open();
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Something went wrong. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!busId || !travelDate || seats.length === 0) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] px-6 pb-16 pt-24">
        <div className="mx-auto w-full max-w-3xl">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Checkout unavailable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">
                Booking details are missing. Go back and select your seats
                again.
              </p>
              <Button asChild className="rounded-full">
                <Link href="/bus-tickets">Back to bus search</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] px-6 pb-16 pt-24">
        <div className="mx-auto w-full max-w-3xl">
          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader className="flex flex-row items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <CardTitle className="text-emerald-900">
                Payment successful
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-emerald-800">
                Your booking is confirmed. Booking ID: {success.bookingId}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="rounded-full">
                  <Link href="/bookings">View my bookings</Link>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-emerald-200 text-emerald-800"
                  onClick={() => router.push("/bus-tickets")}
                >
                  Book another trip
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] px-6 pb-16 pt-24">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Checkout
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Confirm passengers and pay securely
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Review your trip details, add passenger information, and complete
            payment using Razorpay.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Passenger details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {passengers.map((passenger, index) => (
                  <div
                    key={passenger.seatNumber}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        Seat {passenger.seatNumber}
                      </p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        Passenger {index + 1}
                      </span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Full name
                        </label>
                        <Input
                          value={passenger.name}
                          onChange={(event) =>
                            updatePassenger(index, {
                              name: event.target.value,
                            })
                          }
                          placeholder="Passenger name"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Age
                        </label>
                        <Input
                          value={passenger.age}
                          onChange={(event) =>
                            updatePassenger(index, {
                              age: event.target.value,
                            })
                          }
                          placeholder="Age"
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Gender
                        </label>
                        <select
                          value={passenger.gender}
                          onChange={(event) =>
                            updatePassenger(index, {
                              gender: event.target.value as PassengerForm["gender"],
                            })
                          }
                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Mobile number
                        </label>
                        <Input
                          value={passenger.mobileNumber}
                          onChange={(event) =>
                            updatePassenger(index, {
                              mobileNumber: event.target.value,
                            })
                          }
                          placeholder="10-digit mobile"
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          ID type
                        </label>
                        <select
                          value={passenger.identificationType}
                          onChange={(event) =>
                            updatePassenger(index, {
                              identificationType:
                                event.target.value as PassengerForm["identificationType"],
                            })
                          }
                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <option value="aadhar">Aadhar</option>
                          <option value="passport">Passport</option>
                          <option value="dl">Driving License</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          ID number
                        </label>
                        <Input
                          value={passenger.identificationNumber}
                          onChange={(event) =>
                            updatePassenger(index, {
                              identificationNumber: event.target.value,
                            })
                          }
                          placeholder="ID number"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {error ? (
              <div
                className={cn(
                  "rounded-2xl border p-4 text-sm",
                  requiresLogin
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-rose-200 bg-rose-50 text-rose-700",
                )}
              >
                <p>{error}</p>
                {requiresLogin ? (
                  <div className="mt-3">
                    <Button asChild className="rounded-full" size="sm">
                      <Link href="/login">Sign in to continue</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Trip summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-600">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Bus
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {busName}
                  </p>
                  <p className="text-sm text-slate-500">{operatorName}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Route
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {boardingPoint} → {droppingPoint}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateLabel(travelDate)} • {direction}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Seats
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {seats.map((seat) => (
                      <span
                        key={seat}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600"
                      >
                        {seat}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Promo code
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={promoCode}
                      onChange={(event) => setPromoCode(event.target.value)}
                      placeholder="Enter code"
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleApplyOffer}
                      disabled={promoLoading || loading || verifying}
                      className="h-9 rounded-full"
                    >
                      {promoLoading ? "Applying..." : "Apply"}
                    </Button>
                    {appliedOffer ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleRemoveOffer}
                        disabled={promoLoading || loading || verifying}
                        className="h-9 rounded-full text-rose-600 hover:text-rose-700"
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  {appliedOffer ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <Tag className="h-3.5 w-3.5" />
                      {appliedOffer.offerSnapshot?.title || "Offer applied"} (
                      {appliedOffer.code})
                    </p>
                  ) : null}
                  {promoError ? (
                    <p className="mt-2 text-xs text-rose-600">{promoError}</p>
                  ) : null}
                  {requiresLogin && promoError ? (
                    <div className="mt-2">
                      <Button asChild size="sm" className="rounded-full">
                        <Link href="/login">Sign in to apply offers</Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span>Fare per passenger</span>
                    <span className="font-semibold text-slate-900">
                      {formatFare(farePerPassenger)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Base fare</span>
                    <span className="text-base font-semibold text-slate-900">
                      {formatFare(baseFareAmount)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-emerald-700">
                    <span>Discount</span>
                    <span className="font-semibold">- {formatFare(discountAmount)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
                    <span>Total payable</span>
                    <span className="text-base font-semibold text-slate-900">
                      {formatFare(finalPayable)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="space-y-4 pt-6">
                <p className="text-sm text-slate-600">
                  Seats will be locked for you while payment is in progress.
                </p>
                <Button
                  className="w-full rounded-full bg-rose-500 hover:bg-rose-600"
                  onClick={handleCheckout}
                  disabled={loading || verifying}
                >
                  {loading || verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {verifying ? "Verifying payment..." : "Processing..."}
                    </>
                  ) : (
                    <>
                      Pay securely
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
