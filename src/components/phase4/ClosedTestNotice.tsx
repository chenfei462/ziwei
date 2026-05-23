"use client";

import { ClipboardCheck } from "lucide-react";

export function ClosedTestNotice() {
  return (
    <section className="closed-test-notice" aria-label="封测说明">
      <div className="panel-title-row">
        <ClipboardCheck aria-hidden="true" size={18} />
        <h2>封测说明</h2>
      </div>
      <p>本阶段面向 50-100 名用户验证完整 MVP 流程：建档、开盘、点选宫位、切换专业/娱乐模式、查看规则溯源、使用手势或按钮替代路径，并提交反馈。</p>
      <p className="muted">反馈只记录任务完成状态、评分、设备环境和文字说明；不采集摄像头画面，不保存完整出生资料。</p>
    </section>
  );
}
