import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "紫微星垣",
    short_name: "紫微星垣",
    description: "隐私友好的紫微斗数命盘、结构化解读、报告和分享网页产品。",
    start_url: "/",
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
