"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Bus,
  CalendarClock,
  Check,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { apiUrl } from "@/lib/api";

const TRIP_TYPES = [
  "one-way",
  "round trip",
  "local hourly",
  "outstation",
  "airport transfer",
  "employee transport",
  "school transport",
  "event shuttle",
] as const;

const PURPOSE_OF_TRIP = [
  "wedding",
  "corporate outing",
  "school trip",
  "tourism",
  "airport",
  "staff shuttle",
] as const;

const GROUP_CATEGORY = ["family", "corporate", "school", "tourist group"] as const;

const AMENITIES = [
  "Wi-Fi",
  "Charging point",
  "Music system",
  "TV",
  "Washroom",
  "Recliner",
  "Sleeper",
  "Ice box",
] as const;

const BUS_TYPES_NEEDED = [
  "mini bus",
  "tempo traveller",
  "luxury coach",
  "sleeper",
  "ac",
  "non-ac",
] as const;

const RENTAL_FORM_SCHEMA = z.object({
  tripType: z.enum(TRIP_TYPES),
  pickupLocation: z.string().min(2).max(120),
  dropLocation: z.string().min(2).max(120),
  viaPointsText: z.string(),

  journeyDate: z.string().min(1),
  reportingTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/, "Reporting time must be in HH:mm format"),
  tripEndDateTime: z.string().min(1),

  rentalDurationUnit: z.enum(["hours", "days", "kilometers"]),
  rentalDurationValue: z.number().min(0.1),
  returnRequired: z.boolean(),

  passengerCount: z.number().int().min(1).max(500),
  luggageQuantity: z.number().int().min(0).max(100),
  luggageType: z.string(),

  busTypesNeeded: z.array(z.enum(BUS_TYPES_NEEDED)),
  seatingCapacityRequired: z.number().int().min(1).max(500),

  specialNeeds: z.object({
    wheelchairAccess: z.boolean(),
    elderlyFriendly: z.boolean(),
    childSeats: z.boolean(),
  }),

  purposeOfTrip: z.enum(PURPOSE_OF_TRIP),
  groupCategory: z.enum(GROUP_CATEGORY),
  requiredAmenities: z.array(z.enum(AMENITIES)),

  customerName: z.string().min(2).max(100),
  mobileNumber: z.string().regex(/^\+?[0-9]{10,15}$/, "Enter a valid mobile number"),
  email: z.string().email(),
  companyName: z.string(),
  gstNumber: z.string(),
});

type RentalFormValues = z.infer<typeof RENTAL_FORM_SCHEMA>;

const parseViaPoints = (raw: string) =>
  raw
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

const toIsoDate = (dateOnly: string) => {
  // `YYYY-MM-DD` is treated as UTC by JS. Keep that stable for the backend.
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  return d.toISOString();
};

export default function RentBusRequestPage() {
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  const form = useForm<RentalFormValues>({
    resolver: zodResolver(RENTAL_FORM_SCHEMA),
    mode: "onChange",
    defaultValues: {
      tripType: "one-way",
      pickupLocation: "",
      dropLocation: "",
      viaPointsText: "",
      journeyDate: "",
      reportingTime: "10:00",
      tripEndDateTime: "",
      rentalDurationUnit: "hours",
      rentalDurationValue: 4,
      returnRequired: false,
      passengerCount: 20,
      luggageQuantity: 0,
      luggageType: "",
      busTypesNeeded: [],
      seatingCapacityRequired: 20,
      specialNeeds: {
        wheelchairAccess: false,
        elderlyFriendly: false,
        childSeats: false,
      },
      purposeOfTrip: "wedding",
      groupCategory: "family",
      requiredAmenities: [],
      customerName: "",
      mobileNumber: "",
      email: "",
      companyName: "",
      gstNumber: "",
    },
  });

  const onSubmit = async (values: RentalFormValues) => {
    setSubmitting(true);
    try {
      const { viaPointsText, ...rest } = values;
      const viaPoints = parseViaPoints(viaPointsText || "");

      const payload = {
        ...rest,
        viaPoints,
        journeyDate: toIsoDate(values.journeyDate),
        tripEndDateTime: new Date(values.tripEndDateTime).toISOString(),
      };

      const response = await fetch(apiUrl("/api/rentals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = result?.message || result?.errors?.[0]?.message || "Failed to submit rental request";
        throw new Error(message);
      }

      setSuccessId(result?.data?.rentalRequestId ?? null);
      toast.success("Rental request submitted successfully!");
      form.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit rental request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (successId) {
    return (
      <main className="min-h-screen bg-slate-50 pb-12 pt-28 dark:bg-[#0b1020]">
        <div className="mx-auto max-w-3xl px-6">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-lg dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <Check className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Request received
            </h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              We’ll contact you shortly with the best vehicle options.
            </p>
            <div className="mt-6 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
              Request ID: <span className="ml-2 font-bold">{successId}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessId(null)}
              className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Submit another request
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative overflow-hidden bg-slate-50 px-4 pb-16 pt-28 sm:px-6 dark:bg-[#0b1020]">
      <section className="relative mx-auto w-full max-w-6xl">
        <div className="mb-8 rounded-4xl border border-white/70 bg-white/80 p-6 shadow-2xl shadow-slate-900/15 backdrop-blur-xl sm:p-10 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/30">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
              <Bus className="h-4 w-4" />
              Rent Bus Service
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100/80 px-4 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" />
              Instant request
            </div>
          </div>

          <h1 className="mt-6 text-balance text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
            Rent a Bus
          </h1>

          <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-300">
            Tell us your trip details and we’ll contact you with the best vehicle options for weddings, corporate
            events, school trips, and private tours.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Users, label: "Corporate and group travel" },
              { icon: ShieldCheck, label: "Verified drivers and operators" },
              { icon: CalendarClock, label: "Flexible hourly and daily plans" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200/70 bg-white/75 p-4 text-sm font-medium text-slate-700 shadow-sm shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200"
              >
                <Icon className="mb-2 h-5 w-5 text-sky-600 dark:text-sky-300" />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-slate-900/70">
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-8"
          >
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Customer / Trip Request Inputs
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Fill all required fields. Optional details help us recommend the right bus.
              </p>
            </div>

            <div className="space-y-6 rounded-2xl border border-slate-200/60 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Trip type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("tripType")}
                  >
                    {TRIP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-rose-600">
                    {form.formState.errors.tripType?.message}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Rental duration <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                      {...form.register("rentalDurationUnit")}
                    >
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="kilometers">Kilometers</option>
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                      {...form.register("rentalDurationValue", { valueAsNumber: true })}
                    />
                  </div>
                  <p className="text-xs text-rose-600">
                    {form.formState.errors.rentalDurationValue?.message}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Pickup location <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("pickupLocation")}
                  />
                  <p className="text-xs text-rose-600">
                    {form.formState.errors.pickupLocation?.message}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Drop location <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("dropLocation")}
                  />
                  <p className="text-xs text-rose-600">
                    {form.formState.errors.dropLocation?.message}
                  </p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Multiple stops / via points (one per line or separated by commas)
                  </label>
                  <textarea
                    rows={3}
                    className="w-full resize-y rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("viaPointsText")}
                    placeholder="e.g. City A, City B, Airport Road..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Journey date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("journeyDate")}
                  />
                  <p className="text-xs text-rose-600">{form.formState.errors.journeyDate?.message}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Reporting time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    step={300}
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("reportingTime")}
                  />
                  <p className="text-xs text-rose-600">{form.formState.errors.reportingTime?.message}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Trip end date/time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("tripEndDateTime")}
                  />
                  <p className="text-xs text-rose-600">{form.formState.errors.tripEndDateTime?.message}</p>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950">
                  <input
                    type="checkbox"
                    {...form.register("returnRequired")}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-200">Return required</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Yes / No</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 rounded-2xl border border-slate-200/60 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Passenger requirement
              </h3>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Passenger count <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("passengerCount", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-rose-600">{form.formState.errors.passengerCount?.message}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Seating capacity required <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("seatingCapacityRequired", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-rose-600">{form.formState.errors.seatingCapacityRequired?.message}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Luggage quantity
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("luggageQuantity", { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Luggage type
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("luggageType")}
                    placeholder="e.g. bags, suitcases, trunks"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Bus type needed (select all that apply)
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {BUS_TYPES_NEEDED.map((t) => (
                      <label
                        key={t}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                      >
                        <input
                          type="checkbox"
                          value={t}
                          {...form.register("busTypesNeeded")}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          {t === "ac" ? "AC" : t === "non-ac" ? "Non-AC" : t}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Special needs
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950">
                      <input
                        type="checkbox"
                        {...form.register("specialNeeds.wheelchairAccess")}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      <span>Wheelchair access</span>
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950">
                      <input
                        type="checkbox"
                        {...form.register("specialNeeds.elderlyFriendly")}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      <span>Elderly-friendly</span>
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950">
                      <input
                        type="checkbox"
                        {...form.register("specialNeeds.childSeats")}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      <span>Child seats</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 rounded-2xl border border-slate-200/60 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Use-case context
              </h3>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Purpose of trip <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("purposeOfTrip")}
                  >
                    {PURPOSE_OF_TRIP.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-rose-600">{form.formState.errors.purposeOfTrip?.message}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Group category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("groupCategory")}
                  >
                    {GROUP_CATEGORY.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-rose-600">{form.formState.errors.groupCategory?.message}</p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Required amenities (select all that apply)
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {AMENITIES.map((a) => (
                      <label
                        key={a}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                      >
                        <input
                          type="checkbox"
                          value={a}
                          {...form.register("requiredAmenities")}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        <span className="font-medium">{a}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 rounded-2xl border border-slate-200/60 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Contact inputs
              </h3>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Customer name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("customerName")}
                  />
                  <p className="text-xs text-rose-600">{form.formState.errors.customerName?.message}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Mobile number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("mobileNumber")}
                  />
                  <p className="text-xs text-rose-600">{form.formState.errors.mobileNumber?.message}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("email")}
                  />
                  <p className="text-xs text-rose-600">{form.formState.errors.email?.message}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    Company name (B2B)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("companyName")}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">
                    GST number (optional)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100"
                    {...form.register("gstNumber")}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                By submitting, you agree that we can contact you about your rental request.
              </div>
              <button
                type="submit"
                disabled={submitting || !form.formState.isValid}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>Submit rental request</>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
