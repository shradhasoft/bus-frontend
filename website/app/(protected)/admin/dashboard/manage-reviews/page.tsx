import React from "react";
import { ReviewsTable } from "@/components/ReviewsTable";
import { MessageSquareText } from "lucide-react";

export const metadata = {
  title: "Manage Reviews | Admin Dashboard",
  description: "View and manage all user reviews.",
};

const ManageReviewsPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquareText className="h-6 w-6" />
          Manage Reviews
        </h1>
        <p className="text-muted-foreground">
          View all reviews submitted by users and moderate content.
        </p>
      </div>

      <ReviewsTable />
    </div>
  );
};

export default ManageReviewsPage;
