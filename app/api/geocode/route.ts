import { NextResponse } from "next/server";

const MAPBOX_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

type GeocodeResult = {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
};

type MapboxFeature = {
  center?: unknown;
  text?: unknown;
  place_name?: unknown;
};

const toStringValue = (value: unknown) =>
  typeof value === "string" ? value : "";

const toNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const lat = toNumber(searchParams.get("lat"));
  const lng = toNumber(searchParams.get("lng"));
  const token = process.env.MAPBOX_API_KEY || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return NextResponse.json(
      { message: "Mapbox access token is not configured." },
      { status: 500 }
    );
  }

  try {
    if (query) {
      const url = new URL(`${MAPBOX_BASE}/${encodeURIComponent(query)}.json`);
      url.searchParams.set("access_token", token);
      url.searchParams.set("autocomplete", "true");
      url.searchParams.set("limit", "6");
      url.searchParams.set("language", "en");

      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return NextResponse.json(
          { message: "Unable to fetch locations." },
          { status: response.status }
        );
      }

      const results = Array.isArray(data?.features)
        ? data.features
            .map((feature: unknown): GeocodeResult | null => {
              if (!feature || typeof feature !== "object") return null;
              const { center, text, place_name: placeName } =
                feature as MapboxFeature;
              if (!Array.isArray(center) || center.length < 2) return null;
              const [centerLng, centerLat] = center;
              if (
                typeof centerLat !== "number" ||
                typeof centerLng !== "number" ||
                !Number.isFinite(centerLat) ||
                !Number.isFinite(centerLng)
              ) {
                return null;
              }
              return {
                name: toStringValue(text) || toStringValue(placeName) || "Unknown",
                displayName: toStringValue(placeName),
                lat: centerLat,
                lng: centerLng,
              };
            })
            .filter(Boolean)
        : [];

      return NextResponse.json({ results });
    }

    if (lat !== null && lng !== null) {
      const url = new URL(`${MAPBOX_BASE}/${lng},${lat}.json`);
      url.searchParams.set("access_token", token);
      url.searchParams.set("limit", "1");
      url.searchParams.set("language", "en");

      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return NextResponse.json(
          { message: "Unable to reverse geocode." },
          { status: response.status }
        );
      }

      const feature = Array.isArray(data?.features) ? data.features[0] : null;
      const name = feature?.text || feature?.place_name || "Unknown";
      const displayName = feature?.place_name || "";

      return NextResponse.json({
        results: [
          {
            name,
            displayName,
            lat,
            lng,
          },
        ],
      });
    }

    return NextResponse.json(
      { message: "Missing query or coordinates." },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { message: "Geocoding service error." },
      { status: 500 }
    );
  }
};
