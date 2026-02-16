"use client";

import React, { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Loader2, Trash2, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Review {
  _id: string;
  user: {
    _id: string;
    fullName: string;
    email: string;
  };
  bus: {
    _id: string;
    busName: string;
    busNumber: string;
  };
  rating: number;
  comment: string;
  createdAt: string;
}

interface ReviewsResponse {
  success: boolean;
  count: number;
  total: number;
  totalPages: number;
  currentPage: number;
  data: Review[];
}

export function ReviewsTable() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search and Filter State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [ratingFilter]);

  // Function to fetch reviews
  const fetchReviews = useCallback(
    async (pageNum: number) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: "10",
        });

        if (debouncedSearch) {
          params.append("search", debouncedSearch);
        }
        if (ratingFilter !== "all") {
          params.append("rating", ratingFilter);
        }

        const response = await fetch(
          apiUrl(`/api/reviews/admin/all?${params.toString()}`),
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch reviews");
        }

        const data: ReviewsResponse = await response.json();
        setReviews(data.data);
        setTotalPages(data.totalPages);
        setPage(data.currentPage);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        toast.error("Failed to load reviews");
      } finally {
        setIsLoading(false);
      }
    },
    [debouncedSearch, ratingFilter],
  );

  useEffect(() => {
    fetchReviews(page);
  }, [page, debouncedSearch, ratingFilter, fetchReviews]);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      setIsDeleting(true);
      const response = await fetch(apiUrl(`/api/reviews/admin/${deleteId}`), {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete review");
      }

      toast.success("Review deleted successfully");
      fetchReviews(page); // Refresh list
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error("Failed to delete review");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search reviews (User, Bus, Comment)..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Filter by Rating:
          </span>
          <select
            className="h-10 w-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={ratingFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setRatingFilter(e.target.value)
            }
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      </div>

      <div className="rounded-md border bg-white dark:bg-black/20 dark:border-white/10">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm text-left">
            <thead className="[&_tr]:border-b dark:[&_tr]:border-white/10">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted dark:border-white/10">
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[20%]">
                  User
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[15%]">
                  Bus
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[10%]">
                  Rating
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[30%]">
                  Comment
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[15%]">
                  Date
                </th>
                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right w-[10%]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No reviews found.
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr
                    key={review._id}
                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted dark:border-white/5 dark:hover:bg-white/5"
                  >
                    <td className="p-4 align-middle">
                      <div className="font-semibold">
                        {review.user?.fullName || "Deleted User"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {review.user?.email}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-medium">
                        {review.bus?.busName || "Unknown Bus"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {review.bus?.busNumber}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{review.rating}</span>
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <p className="line-clamp-2" title={review.comment}>
                        {review.comment}
                      </p>
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">
                      {format(new Date(review.createdAt), "PPP")}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                        onClick={() => setDeleteId(review._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Showing page {page} of {totalPages}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isLoading}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Review?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              review and recalculate the bus rating.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
