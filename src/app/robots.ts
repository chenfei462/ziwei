import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/chart/new", "/account", "/member", "/orders", "/support", "/legal/", "/share/"],
        disallow: ["/internal/", "/api/", "/ops", "/commercial/dashboard", "/immersive"]
      }
    ],
    sitemap: "/sitemap.xml"
  };
}
