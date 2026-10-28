import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "紫微星垣",
    template: "%s | 紫微星垣"
  },
  description: "生成隐私友好的紫微观察卡、今日星垣卡、7 日挑战和结构化报告。",
  openGraph: {
    title: "紫微星垣",
    description: "生成不暴露生日的今日观察卡，看见性格结构、关系模式和阶段节奏。",
    images: [
      {
        url: "/share-card-preview.png",
        width: 1200,
        height: 630,
        alt: "紫微星垣今日星垣卡预览"
      }
    ],
    type: "website",
    locale: "zh_CN"
  },
  twitter: {
    card: "summary_large_image",
    title: "紫微星垣",
    description: "生成你的紫微观察卡，看见今日关键词和 7 日观察节奏。",
    images: ["/share-card-preview.png"]
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
