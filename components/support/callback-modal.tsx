"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, PhoneCall } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiUrl } from "@/lib/api";

type CallbackFormData = {
  name: string;
  phone: string;
  message?: string;
};

export const CallbackModal = ({ trigger }: { trigger?: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CallbackFormData>();

  const onSubmit = async (data: CallbackFormData) => {
    console.log("Submitting form data:", data);
    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl("/api/callback-requests"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || "Failed to submit request.");
      }

      toast.success("Callback request submitted successfully!");
      setOpen(false);
      reset();
    } catch (error) {
      console.error("Form submission error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <PhoneCall className="h-4 w-4" />
            Request a Callback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
              <PhoneCall className="h-4 w-4" />
            </div>
            Request a Callback
          </DialogTitle>
          <DialogDescription>
            Leave your details below and one of our agents will get back to you
            shortly.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit, (err) =>
            console.log("Form errors:", err),
          )}
          className="space-y-4 py-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">
              Full Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="John Doe"
              {...register("name", { required: "Name is required" })}
              className={errors.name ? "border-rose-500" : ""}
            />
            {errors.name && (
              <p className="text-[10px] text-rose-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Phone Number <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="phone"
              placeholder="+91 9876543210"
              {...register("phone", {
                required: "Phone number is required",
                pattern: {
                  value: /^\+?[1-9]\d{1,14}$/,
                  message: "Please enter a valid phone number",
                },
              })}
              className={errors.phone ? "border-rose-500" : ""}
            />
            {errors.phone && (
              <p className="text-[10px] text-rose-500">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="How can we help you?"
              {...register("message")}
              className="resize-none"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
