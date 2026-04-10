import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://bookmyseat-eosin.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ["en", "hi"];
  const now = new Date();

  // Static public pages with their priorities and change frequencies
  const staticPages = [
    { path: "", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/bus-tickets", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/offers", priority: 0.8, changeFrequency: "daily" as const },
    { path: "/track", priority: 0.7, changeFrequency: "hourly" as const },
    { path: "/rent", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/help", priority: 0.6, changeFrequency: "weekly" as const },
    { path: "/careers", priority: 0.5, changeFrequency: "weekly" as const },
    { path: "/press", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/privacy", priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/terms", priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/refunds", priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/cookies", priority: 0.3, changeFrequency: "monthly" as const },
    {
      path: "/accessibility",
      priority: 0.3,
      changeFrequency: "monthly" as const,
    },
    { path: "/fleet", priority: 0.5, changeFrequency: "weekly" as const },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const page of staticPages) {
      entries.push({
        url: `${SITE_URL}/${locale}${page.path}`,
        lastModified: now,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${SITE_URL}/${l}${page.path}`]),
          ),
        },
      });
    }
  }

  return entries;
}
