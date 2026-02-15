"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useParams } from "next/navigation";

const JourneyTracker = dynamic(
  () => import("@/components/tracking/journey-tracker"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading tracking view...
      </div>
    ),
  },
);

export default function TrackJourneyPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
          Loading...
        </div>
      }
    >
      <JourneyTracker bookingId={bookingId} />
    </Suspense>
  );
}
