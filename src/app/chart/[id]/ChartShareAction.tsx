"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

type ChartShareActionProps = {
  chartId: string;
  title: string;
  summary: string;
  buttonLabel?: string;
};

export function ChartShareAction({ chartId, title, summary, buttonLabel = "生成脱敏分享" }: ChartShareActionProps) {
  const [shareUrl, setShareUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  async function createShare() {
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/share/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source_type: "chart_summary",
          source_id: chartId,
          title,
          summary,
          keywords: ["紫微斗数", "自我观察"],
          safety_flags: ["daily_observation_only", "avoid_absolute_prediction"]
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "创建分享失败。");
      setShareUrl(payload.share_url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建分享失败。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="public-action-card">
      <button disabled={isLoading} onClick={createShare} type="button">
        <Share2 aria-hidden="true" size={17} />
        {isLoading ? "生成分享中" : buttonLabel}
      </button>
      {shareUrl ? <a href={shareUrl}>打开分享页</a> : null}
      {error ? <p className="error-message">{error}</p> : null}
    </div>
  );
}
