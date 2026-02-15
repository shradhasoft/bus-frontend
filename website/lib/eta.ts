/**
 * ETA (Estimated Arrival Time) utilities for bus tracking.
 *
 * Uses haversine distance and live bus data to compute the estimated
 * time of arrival at the user's nearest route stop.
 */

// ─── types ───────────────────────────────────────────────────────────

export type LatLng = { lat: number; lng: number };

export type TripTime = {
  hours: number;
  minutes: number;
};

export type TripStop = {
  arrivalTime?: TripTime;
  departureTime?: TripTime;
  distanceFromOrigin?: number; // km
};

export type RouteStopWithTrips = {
  city?: string;
  stopCode?: string;
  location?: LatLng;
  upTrip?: TripStop;
  downTrip?: TripStop;
};

export type ETAResult = {
  /** The nearest stop to the user */
  nearestStop: RouteStopWithTrips;
  /** Index of the nearest stop in the stops array */
  nearestStopIndex: number;
  /** Distance from user to the nearest stop (km) */
  distanceToStopKm: number;
  /** Estimated minutes until bus reaches nearest stop, or null if unavailable */
  etaMinutes: number | null;
  /** Human-readable ETA label */
  etaLabel: string;
  /** Status of the bus relative to the user's stop */
  status: "approaching" | "at-stop" | "passed" | "unknown";
};

// ─── geo math ────────────────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

/** Haversine distance between two lat/lng points in km. */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLng = (b.lng - a.lng) * DEG_TO_RAD;
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}

// ─── nearest stop ────────────────────────────────────────────────────

/**
 * Find the route stop closest to a given location.
 */
export function findNearestStop(
  userLocation: LatLng,
  stops: RouteStopWithTrips[],
): { stop: RouteStopWithTrips; index: number; distanceKm: number } | null {
  if (!stops.length) return null;

  let bestIdx = -1;
  let bestDist = Infinity;

  for (let i = 0; i < stops.length; i++) {
    const loc = stops[i].location;
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng))
      continue;
    const d = haversineDistance(userLocation, loc);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  if (bestIdx < 0) return null;
  return { stop: stops[bestIdx], index: bestIdx, distanceKm: bestDist };
}

// ─── bus progress along route ────────────────────────────────────────

/**
 * Estimate the bus's current "distance from origin" by finding the
 * nearest segment on the route and interpolating.
 */
export function estimateBusDistanceFromOrigin(
  busLocation: LatLng,
  stops: RouteStopWithTrips[],
  direction: "up" | "down" = "up",
): number | null {
  if (stops.length < 2) return null;

  let bestIdx = -1;
  let bestDist = Infinity;

  for (let i = 0; i < stops.length; i++) {
    const loc = stops[i].location;
    if (!loc) continue;
    const d = haversineDistance(busLocation, loc);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  if (bestIdx < 0) return null;

  const trip = direction === "down" ? "downTrip" : "upTrip";
  const stopDist = stops[bestIdx]?.[trip]?.distanceFromOrigin;
  if (typeof stopDist !== "number") return null;

  // If the bus is very close to a stop (< 0.5 km), return that stop's distance
  if (bestDist < 0.5) return stopDist;

  // Otherwise interpolate between this stop and the next closer neighbor
  // to get a more accurate position
  const prevIdx = bestIdx > 0 ? bestIdx - 1 : null;
  const nextIdx = bestIdx < stops.length - 1 ? bestIdx + 1 : null;

  let neighborIdx: number | null = null;
  if (prevIdx !== null && nextIdx !== null) {
    const dPrev = haversineDistance(
      busLocation,
      stops[prevIdx].location as LatLng,
    );
    const dNext = haversineDistance(
      busLocation,
      stops[nextIdx].location as LatLng,
    );
    neighborIdx = dPrev < dNext ? prevIdx : nextIdx;
  } else {
    neighborIdx = prevIdx ?? nextIdx;
  }

  if (neighborIdx === null) return stopDist;

  const neighborDist = stops[neighborIdx]?.[trip]?.distanceFromOrigin;
  if (typeof neighborDist !== "number") return stopDist;

  // Linear interpolation between the two stops
  const segLen = haversineDistance(
    stops[bestIdx].location as LatLng,
    stops[neighborIdx].location as LatLng,
  );
  if (segLen < 0.001) return stopDist;

  const ratio = Math.min(1, bestDist / segLen);
  return stopDist + ratio * (neighborDist - stopDist);
}

// ─── ETA computation ─────────────────────────────────────────────────

/**
 * Compute ETA for the bus to reach the user's nearest stop.
 *
 * @param busLocation  Current bus lat/lng
 * @param busSpeedMs   Bus speed in m/s (from live data), or null
 * @param userLocation User's lat/lng
 * @param stops        Ordered route stops with trip data
 * @param direction    Travel direction ("up" or "down")
 */
export function computeETA(
  busLocation: LatLng,
  busSpeedMs: number | null | undefined,
  userLocation: LatLng,
  stops: RouteStopWithTrips[],
  direction: "up" | "down" = "up",
): ETAResult | null {
  if (!stops.length) return null;

  // 1. Find user's nearest stop
  const nearest = findNearestStop(userLocation, stops);
  if (!nearest) return null;

  const trip = direction === "down" ? "downTrip" : "upTrip";
  const userStopDist = nearest.stop[trip]?.distanceFromOrigin;
  if (typeof userStopDist !== "number") {
    return {
      nearestStop: nearest.stop,
      nearestStopIndex: nearest.index,
      distanceToStopKm: Math.round(nearest.distanceKm * 10) / 10,
      etaMinutes: null,
      etaLabel: "Schedule unavailable",
      status: "unknown",
    };
  }

  // 2. Estimate bus's current distance from origin
  const busDist = estimateBusDistanceFromOrigin(busLocation, stops, direction);
  if (busDist === null) {
    return {
      nearestStop: nearest.stop,
      nearestStopIndex: nearest.index,
      distanceToStopKm: Math.round(nearest.distanceKm * 10) / 10,
      etaMinutes: null,
      etaLabel: "Calculating…",
      status: "unknown",
    };
  }

  // 3. Determine remaining distance
  const remainingKm = userStopDist - busDist;

  if (remainingKm < -0.5) {
    // Bus has passed the user's stop
    return {
      nearestStop: nearest.stop,
      nearestStopIndex: nearest.index,
      distanceToStopKm: Math.round(nearest.distanceKm * 10) / 10,
      etaMinutes: null,
      etaLabel: "Bus has passed this stop",
      status: "passed",
    };
  }

  if (Math.abs(remainingKm) <= 0.5) {
    return {
      nearestStop: nearest.stop,
      nearestStopIndex: nearest.index,
      distanceToStopKm: Math.round(nearest.distanceKm * 10) / 10,
      etaMinutes: 0,
      etaLabel: "Arriving now!",
      status: "at-stop",
    };
  }

  // 4. Calculate ETA
  let etaMinutes: number | null = null;

  // Primary: use live speed
  const speedKmH =
    typeof busSpeedMs === "number" && busSpeedMs > 0.5
      ? busSpeedMs * 3.6
      : null;

  if (speedKmH !== null && speedKmH > 1) {
    etaMinutes = Math.round((remainingKm / speedKmH) * 60);
  }

  // Fallback: use schedule-based average speed
  if (etaMinutes === null) {
    const firstStop = stops[0]?.[trip];
    const lastStop = stops[stops.length - 1]?.[trip];
    if (
      firstStop?.departureTime &&
      lastStop?.arrivalTime &&
      firstStop.distanceFromOrigin !== undefined &&
      lastStop.distanceFromOrigin !== undefined
    ) {
      const totalDist =
        lastStop.distanceFromOrigin - firstStop.distanceFromOrigin;
      const depMin =
        firstStop.departureTime.hours * 60 + firstStop.departureTime.minutes;
      const arrMin =
        lastStop.arrivalTime.hours * 60 + lastStop.arrivalTime.minutes;
      const totalMinutes =
        arrMin > depMin ? arrMin - depMin : arrMin + 1440 - depMin;
      if (totalDist > 0 && totalMinutes > 0) {
        const avgSpeedKmH = totalDist / (totalMinutes / 60);
        etaMinutes = Math.round((remainingKm / avgSpeedKmH) * 60);
      }
    }
  }

  // Format label
  let etaLabel: string;
  if (etaMinutes !== null && etaMinutes >= 0) {
    if (etaMinutes < 1) {
      etaLabel = "Less than a minute";
    } else if (etaMinutes < 60) {
      etaLabel = `~${etaMinutes} min`;
    } else {
      const h = Math.floor(etaMinutes / 60);
      const m = etaMinutes % 60;
      etaLabel = m > 0 ? `~${h}h ${m}m` : `~${h}h`;
    }
  } else {
    etaLabel = "Calculating…";
  }

  return {
    nearestStop: nearest.stop,
    nearestStopIndex: nearest.index,
    distanceToStopKm: Math.round(nearest.distanceKm * 10) / 10,
    etaMinutes,
    etaLabel,
    status: "approaching",
  };
}
