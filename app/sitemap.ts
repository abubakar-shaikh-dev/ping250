import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ping250.abubakarshaikh.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: APP_URL, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${APP_URL}/docs`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];
}
