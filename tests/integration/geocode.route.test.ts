import { afterEach, describe, expect, test, vi } from "vitest";

import { GET } from "@/app/api/geocode/route";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("GET /api/geocode", () => {
  test("returns results for forward geocode query", async () => {
    process.env.MAPBOX_API_KEY = "test-token";

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            text: "Kolkata",
            place_name: "Kolkata, West Bengal, India",
            center: [88.3639, 22.5726],
          },
        ],
      }),
    } as unknown as Response);

    const response = await GET(
      new Request("http://localhost:3000/api/geocode?q=kolkata"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results[0]).toEqual(
      expect.objectContaining({
        name: "Kolkata",
        lat: 22.5726,
        lng: 88.3639,
      }),
    );
  });

  test("returns 500 when mapbox token is missing", async () => {
    delete process.env.MAPBOX_API_KEY;
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const response = await GET(new Request("http://localhost:3000/api/geocode?q=x"));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.message).toContain("Mapbox access token");
  });
});

