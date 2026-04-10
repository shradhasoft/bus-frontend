import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://bookmyseat-eosin.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/super-admin/",
          "/bus-owner/",
          "/conductor/",
          "/dashboard/",
          "/profile/",
          "/mybookings/",
          "/checkout/",
          "/track-journey/",
          "/_next/",
        ],
      },
      {
        // Block AI scrapers from training data
        userAgent: ["GPTBot", "ChatGPT-User", "CCBot", "anthropic-ai"],
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
