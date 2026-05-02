"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  LifeBuoy,
  Send,
  Loader2,
  AlertCircle,
  MessageSquare,
  Hash,
} from "lucide-react";
import { apiUrl } from "@/lib/api";

const ticketSchema = z.object({
  subject: z
    .string()
    .min(3, "Subject must be at least 3 characters")
    .max(100, "Subject cannot exceed 100 characters"),
  priority: z.enum(["Low", "Medium", "High"]),
  description: z
    .string()
    .min(10, "Please provide more details (at least 10 characters)")
    .max(1000, "Description is too long (max 1000 characters)"),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

export default function TicketSubmissionPage() {
  const t = useTranslations("support.ticket");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successTicketId, setSuccessTicketId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: "",
      priority: "Medium",
      description: "",
    },
    mode: "onChange",
  });

  const onSubmit = async (data: TicketFormValues) => {
    try {
      setIsSubmitting(true);
      const response = await fetch(apiUrl("/api/tickets"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(t("mustBeLoggedIn"));
        }
        throw new Error(result.message || t("failedToSubmit"));
      }

      setSuccessTicketId(result.data.ticketId);
      toast.success("Support ticket raised successfully!");
      reset();
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(t("errorOccurred"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successTicketId) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-lg dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <LifeBuoy className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-800 dark:text-white">
            {t("ticketReceived")}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {t("ticketSuccessMessage")}
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <Hash className="h-4 w-4 text-emerald-500" />
            {t("ticketId")} <span className="font-bold">{successTicketId}</span>
          </div>
          <button
            onClick={() => setSuccessTicketId(null)}
            className="mt-8 block w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {t("submitAnother")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12 pt-28 dark:bg-[#0b1020]">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-8 text-center">
          <h1 className="inline-flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <LifeBuoy className="h-6 w-6" />
            </span>
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-400">
            {t("heroDescription")}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-10 dark:border-white/10 dark:bg-slate-900 dark:shadow-none">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2.5 sm:col-span-2">
                  <label className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    {t("subjectLabel")} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      {...register("subject")}
                      type="text"
                      placeholder={t("subjectPlaceholder")}
                      className={`w-full rounded-xl border bg-slate-50 px-4 py-3.5 pl-11 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 ${
                        errors.subject
                          ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500/30 dark:focus:border-rose-500"
                          : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-white/10 dark:focus:border-indigo-500"
                      }`}
                    />
                    <MessageSquare
                      className={`absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 ${
                        errors.subject
                          ? "text-rose-400"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    />
                  </div>
                  {errors.subject && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-rose-500">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.subject.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2.5 sm:col-span-2">
                  <label className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    {t("priorityLabel")} <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[t("priorityLow"), t("priorityMedium"), t("priorityHigh")].map((level) => (
                      <label
                        key={level}
                        className="group relative flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm font-medium transition-all hover:bg-slate-50 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-700 dark:border-white/10 dark:bg-slate-950 dark:hover:bg-white/5 dark:has-[:checked]:border-indigo-500 dark:has-[:checked]:bg-indigo-500/10 dark:has-[:checked]:text-indigo-300"
                      >
                        <input
                          type="radio"
                          value={level}
                          {...register("priority")}
                          className="sr-only"
                        />
                        {level}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                      {t("descriptionLabel")}{" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-xs text-slate-400">
                      {t("markdownSupported")}
                    </span>
                  </div>
                  <textarea
                    {...register("description")}
                    rows={6}
                    placeholder={t("descriptionPlaceholder")}
                    className={`w-full resize-y rounded-xl border bg-slate-50 p-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 ${
                      errors.description
                        ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500/30 dark:focus:border-rose-500"
                        : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-white/10 dark:focus:border-indigo-500"
                    }`}
                  />
                  {errors.description && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-rose-500">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.description.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500 dark:bg-white/5 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t("information")}:
              </span>{" "}
              {t("infoMessage")}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !isValid}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-700 hover:shadow-indigo-600/40 focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("submittingTicket")}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {t("submitTicket")}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
