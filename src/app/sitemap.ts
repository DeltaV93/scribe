import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://inkra.ai";

  // Static marketing pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    // Future marketing pages
    // { url: `${baseUrl}/pricing`, ... },
    // { url: `${baseUrl}/features`, ... },
    // { url: `${baseUrl}/use-cases/nonprofits`, ... },
    // { url: `${baseUrl}/use-cases/healthcare`, ... },
    // { url: `${baseUrl}/use-cases/sales`, ... },
    // { url: `${baseUrl}/blog`, ... },
  ];

  return staticPages;
}
