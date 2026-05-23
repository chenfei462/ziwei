"use client";

import { ListRestart } from "lucide-react";
import type { GestureEventLog } from "../../phase2/types.js";

export function GestureLogPanel({ logs }: { logs: GestureEventLog[] }) {
  return (
    <section className="log-panel">
      <div className="panel-title-row">
        <ListRestart aria-hidden="true" size={18} />
        <h2>手势日志</h2>
      </div>
      {logs.length === 0 ? (
        <p className="muted">暂无手势事件。</p>
      ) : (
        <ol>
          {logs.slice(0, 8).map((log) => (
            <li key={log.id}>
              <span className="mono">{log.type}</span>
              <span>{log.action}</span>
              <span>{Math.round(log.confidence * 100)}%</span>
              <span>{log.source}</span>
              <span>{log.raw_category ?? "manual"}</span>
              <span>{log.stability_frames ? `${log.stability_frames} frames` : "stable n/a"}</span>
              <span>{log.no_video_frame ? "no_video_frame" : "invalid_payload"}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
