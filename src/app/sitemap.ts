import type { MetadataRoute } from "next";

const publicRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/chart/new", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/account", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/member", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/orders", priority: 0.4, changeFrequency: "monthly" as const },
  { path: "/support", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" as const }
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}
