import { useState, useEffect, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/api";

interface ApiOfferItem {
  discountValue?: number | string;
  discountType?: string;
  minOrderAmount?: number;
  code?: string;
  promoCode?: string;
  title?: string;
}

interface OfferCard {
  title: string;
  subtitle: string;
  code: string;
  discount: string;
  gradientStyle: React.CSSProperties;
  accentColor: string;
  tagline: string;
  decorativeIcon: React.JSX.Element;
}

const CARD_THEMES = [
  {
    gradientStyle: {
      background: "linear-gradient(135deg, #f97316, #ea580c, #dc2626)",
    },
    accentColor: "#fde047",
    tagline: "FIRST ORDER",
  },
  {
    gradientStyle: {
      background: "linear-gradient(135deg, #7c3aed, #9333ea, #4338ca)",
    },
    accentColor: "#fde047",
    tagline: "FLASH DEAL",
  },
  {
    gradientStyle: {
      background: "linear-gradient(135deg, #10b981, #16a34a, #0f766e)",
    },
    accentColor: "#fef08a",
    tagline: "CASHBACK",
  },
  {
    gradientStyle: {
      background: "linear-gradient(135deg, #ec4899, #e11d48, #be123c)",
    },
    accentColor: "#fde047",
    tagline: "WEEKEND SPECIAL",
  },
] as const;

function mapApiOffers(rows: ApiOfferItem[]): OfferCard[] {
  const mapped: OfferCard[] = [];

  for (let i = 0; i < rows.length; i++) {
    const item = rows[i];
    const code =
      typeof item?.promoCode === "string"
        ? item.promoCode.trim()
        : typeof item?.code === "string"
          ? item.code.trim()
          : "";
    if (!code) continue;

    const dv = Number(item?.discountValue);
    if (!Number.isFinite(dv) || dv <= 0) continue;

    const isPct = item?.discountType === "percentage";
    const theme = CARD_THEMES[i % CARD_THEMES.length] ?? CARD_THEMES[0];

    mapped.push({
      title:
        typeof item?.title === "string" && item.title.trim()
          ? item.title.trim()
          : isPct
            ? `${dv}% off`
            : `Flat ₹${dv} off`,
      subtitle:
        typeof item?.minOrderAmount === "number" && item.minOrderAmount > 0
          ? `Min booking ₹${item.minOrderAmount}`
          : "On selected bookings",
      discount: isPct ? `${dv}%` : `₹${dv}`,
      code,
      ...theme,
    });
  }

  return mapped;
}

// Global cache with TTL
const CACHE_KEY = "offers_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: OfferCard[];
  timestamp: number;
}

let inMemoryCache: CacheEntry | null = null;
let pendingRequest: Promise<OfferCard[]> | null = null;

function getCachedData(): OfferCard[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const entry: CacheEntry = JSON.parse(cached);
      const now = Date.now();
      if (now - entry.timestamp < CACHE_TTL) {
        inMemoryCache = entry;
        return entry.data;
      }
      localStorage.removeItem(CACHE_KEY);
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

function setCachedData(data: OfferCard[]): void {
  try {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };
    inMemoryCache = entry;
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore cache errors
  }
}

export function useOffers() {
  const [offers, setOffers] = useState<OfferCard[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const hasMounted = useRef(false);

  useEffect(() => {
    // Prevent double-fetch in React Strict Mode
    if (hasMounted.current) return;
    hasMounted.current = true;

    // Check cache first
    const cached = getCachedData();
    if (cached) {
      setOffers(cached);
      return;
    }

    // Use pending request if exists (deduplication)
    if (pendingRequest) {
      pendingRequest
        .then((data) => {
          setOffers(data);
        })
        .catch((err) => {
          setError(err);
        });
      return;
    }

    const controller = new AbortController();

    async function loadOffers() {
      try {
        const res = await fetch(apiUrl("/offers?page=1&limit=4"), {
          signal: controller.signal,
          cache: "force-cache",
        });

        if (!res.ok) {
          setOffers([]);
          return [];
        }

        const payload: unknown = await res.json().catch(() => null);
        if (payload == null || typeof payload !== "object") {
          setOffers([]);
          return [];
        }

        const data = (payload as Record<string, unknown>).data;
        if (!Array.isArray(data) || data.length === 0) {
          setOffers([]);
          return [];
        }

        const valid = mapApiOffers(data as ApiOfferItem[]);
        const result = valid.length > 0 ? valid : [];
        
        setCachedData(result);
        setOffers(result);
        return result;
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[useOffers] Failed to fetch offers:", err);
          setError(err as Error);
          setOffers([]);
        }
        return [];
      } finally {
        pendingRequest = null;
      }
    }

    pendingRequest = loadOffers();
    return () => controller.abort();
  }, []);

  return { offers, error, isLoading: offers === null };
}
