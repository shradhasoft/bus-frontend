"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Star, Trash2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { firebaseAuth } from "@/lib/firebase/client";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  onSuccess: () => void;
}

interface ReviewData {
  _id: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export function ReviewModal({
  isOpen,
  onClose,
  bookingId,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingReview, setExistingReview] = useState<ReviewData | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchReview = useCallback(async () => {
    try {
      setIsLoading(true);
      const user = firebaseAuth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      const response = await fetch(
        apiUrl(`/api/reviews/booking/${bookingId}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setExistingReview(data.data);
        setRating(data.data.rating);
        setComment(data.data.comment || "");
      } else {
        // Assume 404 means no review yet, which is fine
        setExistingReview(null);
        setIsEditing(true); // Default to editing mode for new reviews
      }
    } catch (error) {
      console.error("Failed to fetch review", error);
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  const resetForm = () => {
    setRating(0);
    setComment("");
    setHoveredRating(0);
    setExistingReview(null);
    setIsEditing(false);
  };

  // Fetch existing review when modal opens
  useEffect(() => {
    if (isOpen && bookingId) {
      fetchReview();
    } else {
      resetForm();
    }
  }, [isOpen, bookingId, fetchReview]);

  const isEditable = () => {
    if (!existingReview) return true;
    const createdAt = new Date(existingReview.createdAt);
    const now = new Date();
    const diffHours = (now.getTime() - createdAt.getTime()) / 36e5;
    return diffHours <= 72;
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    try {
      setIsSubmitting(true);
      const user = firebaseAuth.currentUser;
      if (!user) {
        toast.error("You must be logged in to review");
        return;
      }
      const token = await user.getIdToken();

      const url = existingReview
        ? apiUrl(`/api/reviews/${existingReview._id}`)
        : apiUrl("/api/reviews");

      const method = existingReview ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId,
          rating,
          comment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to submit review");
      }

      toast.success(
        existingReview ? "Review updated!" : "Thank you for your review!",
      );
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit review",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingReview) return;
    if (!confirm("Are you sure you want to delete this review?")) return;

    try {
      setIsSubmitting(true);
      const user = firebaseAuth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      const response = await fetch(
        apiUrl(`/api/reviews/${existingReview._id}`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete review");
      }

      toast.success("Review deleted");
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const renderFooter = () => {
    if (isLoading) return null;

    if (existingReview && !isEditing) {
      return (
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/10"
            onClick={handleDelete}
            disabled={isSubmitting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            {isEditable() && (
              <Button onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </DialogFooter>
      );
    }

    return (
      <DialogFooter className="gap-2 sm:justify-end">
        <Button
          variant="outline"
          onClick={existingReview ? () => setIsEditing(false) : handleClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {existingReview ? "Updating..." : "Submitting..."}
            </>
          ) : existingReview ? (
            "Update Review"
          ) : (
            "Submit Review"
          )}
        </Button>
      </DialogFooter>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {existingReview && !isEditing ? "Your Review" : "Rate your trip"}
          </DialogTitle>
          <DialogDescription>
            {existingReview && !isEditing
              ? "You have already reviewed this trip."
              : "Share your experience with this bus service."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="grid gap-6 py-4">
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    disabled={!isEditing && !!existingReview}
                    className={cn(
                      "transition-transform focus:outline-hidden",
                      (!existingReview || isEditing) && "hover:scale-110",
                    )}
                    onMouseEnter={() =>
                      (!existingReview || isEditing) && setHoveredRating(star)
                    }
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => setRating(star)}
                  >
                    <Star
                      className={cn(
                        "h-8 w-8 transition-colors",
                        (hoveredRating ? star <= hoveredRating : star <= rating)
                          ? "fill-amber-400 text-amber-400"
                          : "fill-transparent text-slate-300 dark:text-slate-600",
                        !isEditing && existingReview && "cursor-default",
                      )}
                    />
                  </button>
                ))}
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {rating ? (
                  <span className="text-amber-500">{rating} out of 5</span>
                ) : (
                  "Select a rating"
                )}
              </p>
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="comment"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Your review (optional)
              </label>
              <Textarea
                id="comment"
                placeholder="Tell us about your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="h-24 resize-none"
                disabled={!isEditing && !!existingReview}
              />
              {existingReview && !isEditing && !isEditable() && (
                <p className="text-xs text-rose-500">
                  * Editing is only available within 72 hours of submission.
                </p>
              )}
            </div>
          </div>
        )}

        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}
