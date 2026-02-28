import { Suspense } from "react";
import TrackBusView from "@/components/tracking/track-bus-view";

const TrackPage = () => (
  <Suspense
    fallback={
      <div className="mx-auto flex min-h-[40vh] w-full max-w-6xl items-center justify-center px-4 py-12 text-sm text-slate-500">
        Loading live tracking...
      </div>
    }
  >
    <TrackBusView />
  </Suspense>
);

export default TrackPage;
