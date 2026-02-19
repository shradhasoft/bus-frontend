"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GeolocationState = {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  supported: boolean;
  refresh: () => void;
};

const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 60_000, // cache for 60s to avoid excessive prompts
};

/**
 * React hook wrapping the Geolocation API.
 * Requests position once on mount and exposes a `refresh` method.
 */
export function useGeolocation(): GeolocationState {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = typeof window !== "undefined" && "geolocation" in navigator;

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const requestPosition = useCallback(() => {
    if (!supported) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMounted.current) return;
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setAccuracy(
          position.coords.accuracy
            ? Math.round(position.coords.accuracy)
            : null,
        );
        setLoading(false);
      },
      (err) => {
        if (!isMounted.current) return;
        let message: string;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message =
              "Location access denied. Please enable location in browser settings.";
            break;
          case err.POSITION_UNAVAILABLE:
            message = "Location information is unavailable.";
            break;
          case err.TIMEOUT:
            message = "Location request timed out. Try again.";
            break;
          default:
            message = "Unable to retrieve your location.";
        }
        setError(message);
        setLoading(false);
      },
      POSITION_OPTIONS,
    );
  }, [supported]);

  // Auto-request on mount
  useEffect(() => {
    requestPosition();
  }, [requestPosition]);

  return {
    lat,
    lng,
    accuracy,
    loading,
    error,
    supported,
    refresh: requestPosition,
  };
}
