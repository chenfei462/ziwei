"use client";

import { CheckCircle2, Loader2, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const challengeId = "challenge_7_day_stargarden";

type Progress = {
  challenge_id: string;
  status: "not_joined" | "active" | "completed";
  current_count: number;
  target_count: number;
  last_check_in_ref?: string;
  checked_in_refs?: string[];
};

type ChallengeApiPayload = {
  progress?: Progress;
  share_snapshot?: {
    share_id?: string;
  };
};

type ChallengeListPayload = {
  progress?: Progress[];
};

type ChallengeActionProps = {
  chartId: string;
};

type RequestState = "idle" | "loading" | "error";

export function ChallengeAction({ chartId }: ChallengeActionProps) {
  const [progress, setProgress] = useState<Progress | undefined>();
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("打卡成功后会从 0/7 更新为 1/7。");
  const [shareUrl, setShareUrl] = useState<string | undefined>();
  const [checkedInToday, setCheckedInToday] = useState(false);

  const progressLabel = useMemo(() => {
    const current = progress?.current_count ?? 0;
    const target = progress?.target_count ?? 7;
    return `${current}/${target}`;
  }, [progress]);

  useEffect(() => {
    let cancelled = false;
    async function loadProgress() {
      try {
        const response = await fetch("/api/challenge/list", { credentials: "same-origin" });
        const payload = (await response.json()) as ChallengeListPayload;
        if (!response.ok || cancelled) return;
        const loadedProgress = payload.progress?.find((item) => item.challenge_id === challengeId);
        setProgress(loadedProgress);
        setCheckedInToday(loadedProgress ? hasCheckedInToday(loadedProgress, chartId) : false);
      } catch {
        if (!cancelled) setMessage("暂时无法读取挑战进度，仍可稍后重试。");
      }
    }
    void loadProgress();
    return () => {
      cancelled = true;
    };
  }, []);

  async function joinChallenge() {
    setRequestState("loading");
    setMessage("正在加入 7 日观察。");
    try {
      const payload = await postChallenge("/api/challenge/join", { challenge_id: challengeId });
      setProgress(payload.progress);
      setMessage("已加入 7 日观察，今天可以完成第一张星垣卡打卡。");
    } catch (error) {
      setRequestState("error");
      setMessage(error instanceof Error ? error.message : "加入挑战失败，请稍后再试。");
      return;
    }
    setRequestState("idle");
  }

  async function checkInToday() {
    setRequestState("loading");
    setMessage("正在记录今日打卡。");
    try {
      const payload = await postChallenge("/api/challenge/check-in", {
        challenge_id: challengeId,
        check_in_ref: todayCheckInRef(chartId)
      });
      setProgress(payload.progress);
      setCheckedInToday(true);
      setShareUrl(payload.share_snapshot?.share_id ? `/share/${payload.share_snapshot.share_id}` : undefined);
      setMessage("今日打卡完成，进度已记录为 1/7 或更高。");
    } catch (error) {
      setRequestState("error");
      setMessage(error instanceof Error ? error.message : "今日打卡失败，请稍后再试。");
      return;
    }
    setRequestState("idle");
  }

  const isLoading = requestState === "loading";
  const isJoined = Boolean(progress);
  const isCompleted = progress?.status === "completed";

  return (
    <div className="challenge-action-card" aria-live="polite">
      <div className="challenge-title-row">
        <Trophy aria-hidden="true" size={18} />
        <div>
          <h3>7 日星垣挑战</h3>
          <p>每天生成一张观察卡，连续记录阶段节奏。</p>
        </div>
        <strong>{progressLabel}</strong>
      </div>
      <div className="challenge-button-row">
        <button disabled={isLoading || isJoined} onClick={joinChallenge} type="button">
          {isLoading ? <Loader2 aria-hidden="true" size={16} /> : <CheckCircle2 aria-hidden="true" size={16} />}
          加入 7 日观察
        </button>
        <button disabled={isLoading || checkedInToday || isCompleted} onClick={checkInToday} type="button">
          {isLoading ? <Loader2 aria-hidden="true" size={16} /> : <CheckCircle2 aria-hidden="true" size={16} />}
          今日打卡
        </button>
      </div>
      <p className={requestState === "error" ? "error-message" : "muted"}>{message}</p>
      {shareUrl ? <a href={shareUrl}>打开成就分享卡</a> : null}
    </div>
  );
}

function hasCheckedInToday(progress: Progress, chartId: string): boolean {
  const ref = todayCheckInRef(chartId);
  return progress.last_check_in_ref === ref || Boolean(progress.checked_in_refs?.includes(ref));
}

function todayCheckInRef(chartId: string): string {
  return `chart:${chartId}:${businessDateString()}`;
}

function businessDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function postChallenge(url: string, body: { challenge_id: typeof challengeId; check_in_ref?: string }): Promise<ChallengeApiPayload> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as ChallengeApiPayload & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "挑战操作失败，请稍后再试。");
  }
  return payload;
}
