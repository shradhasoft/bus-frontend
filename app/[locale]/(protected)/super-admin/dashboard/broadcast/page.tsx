"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  MessageSquareText,
  Send,
  Loader2,
  Users,
  ShieldAlert,
  Info,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { apiUrl } from "@/lib/api";

const broadcastSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be at most 100 characters"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(500, "Message must be at most 500 characters"),
  role: z.enum(["user", "admin", "owner", "superadmin", "conductor", "all"]),
  type: z.enum(["INFO", "SUCCESS", "WARNING", "ERROR"]),
  link: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type BroadcastFormValues = z.infer<typeof broadcastSchema>;

export default function BroadcastPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<BroadcastFormValues>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: {
      title: "",
      message: "",
      role: "all",
      type: "INFO",
      link: "",
    },
  });

  const selectedType = watch("type");

  const onSubmit = async (data: BroadcastFormValues) => {
    try {
      setIsSubmitting(true);
      const response = await fetch(apiUrl("/api/notifications/broadcast"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to send broadcast");
      }

      toast.success("Broadcast sent successfully!");
      reset();
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("An error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "INFO":
        return <Info className="h-5 w-5 text-blue-500" />;
      case "SUCCESS":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "WARNING":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "ERROR":
        return <ShieldAlert className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-800 dark:text-slate-100">
          <MessageSquareText className="h-7 w-7 text-indigo-500" />
          Broadcast Center
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Send announcements, alerts, and notifications to all users or specific
          roles.
        </p>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172a]">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Target Audience
                </label>
                <div className="relative">
                  <select
                    {...register("role")}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pl-10 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                  >
                    <option value="all">All Users & Staff</option>
                    <option value="user">Normal Users Only</option>
                    <option value="owner">Bus Owners Only</option>
                    <option value="conductor">Conductors Only</option>
                    <option value="admin">Admins Only</option>
                    <option value="superadmin">Super Admins Only</option>
                  </select>
                  <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                {errors.role && (
                  <p className="text-xs text-red-500">{errors.role.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Alert Type
                </label>
                <div className="relative flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
                  <div className="flex shrink-0 items-center justify-center pl-2">
                    {getAlertIcon(selectedType)}
                  </div>
                  <select
                    {...register("type")}
                    className="w-full appearance-none bg-transparent px-2 py-1 text-sm text-slate-700 outline-none dark:text-slate-200"
                  >
                    <option value="INFO">Information</option>
                    <option value="SUCCESS">Success</option>
                    <option value="WARNING">Warning</option>
                    <option value="ERROR">Critical/Error</option>
                  </select>
                </div>
                {errors.type && (
                  <p className="text-xs text-red-500">{errors.type.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Broadcast Title
              </label>
              <input
                {...register("title")}
                type="text"
                placeholder="e.g., System Update Tomorrow"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              />
              {errors.title && (
                <p className="text-xs text-red-500">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Message Content
              </label>
              <textarea
                {...register("message")}
                rows={5}
                placeholder="Write your broadcast message here..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              />
              {errors.message && (
                <p className="text-xs text-red-500">{errors.message.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Optional Link Action (URL)
              </label>
              <input
                {...register("link")}
                type="url"
                placeholder="https://bookmyseat.com/updates"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              />
              {errors.link && (
                <p className="text-xs text-red-500">{errors.link.message}</p>
              )}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending Broadcast...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Send Broadcast Now
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
