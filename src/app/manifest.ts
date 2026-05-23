import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zi Wei Mobile Stargarden",
    short_name: "Stargarden",
    description: "Mobile PWA for daily Stargarden cards, streaks, share landing pages, and community challenges.",
    start_url: "/phase13",
    scope: "/",
    display: "standalone",
    background_color: "#111312",
    theme_color: "#42b8a8",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
