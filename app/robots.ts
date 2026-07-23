import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ping250.abubakarshaikh.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The SMTP routes are an API, not content — keep crawlers off them.
      disallow: ["/api/"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
