import { describe, expect, test } from "vitest";

import {
  computeETA,
  findNearestStop,
  haversineDistance,
  type RouteStopWithTrips,
} from "@/lib/eta";

const stops: RouteStopWithTrips[] = [
  {
    city: "Kolkata",
    location: { lat: 22.5726, lng: 88.3639 },
    upTrip: { distanceFromOrigin: 0 },
  },
  {
    city: "Durgapur",
    location: { lat: 23.5204, lng: 87.3119 },
    upTrip: { distanceFromOrigin: 170 },
  },
  {
    city: "Asansol",
    location: { lat: 23.6739, lng: 86.9524 },
    upTrip: { distanceFromOrigin: 210 },
  },
];

describe("eta utilities", () => {
  test("calculates haversine distance", () => {
    const distance = haversineDistance(
      { lat: 22.5726, lng: 88.3639 },
      { lat: 23.5204, lng: 87.3119 },
    );
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(250);
  });

  test("finds nearest stop to user", () => {
    const nearest = findNearestStop({ lat: 23.51, lng: 87.32 }, stops);
    expect(nearest).not.toBeNull();
    expect(nearest?.stop.city).toBe("Durgapur");
  });

  test("computes approaching ETA result", () => {
    const result = computeETA(
      { lat: 22.8, lng: 88.1 },
      12,
      { lat: 23.51, lng: 87.32 },
      stops,
      "up",
    );
    expect(result).not.toBeNull();
    expect(result?.status).toBe("approaching");
    expect(result?.nearestStop.city).toBe("Durgapur");
  });
});

