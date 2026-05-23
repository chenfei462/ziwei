"use client";

import { CalendarCheck2, Share2, Smartphone, Trophy, UserPlus } from "lucide-react";
import { useState } from "react";
import type {
  ChallengeCheckInResponse,
  ChallengeJoinResponse,
  ChallengeListResponse,
  DailyStreakResponse,
  ReferralEventResponse,
  ShareCreateResponse
} from "../../types.js";

type MobileGrowthPanelProps = {
  memberId: string;
  initialChallenges: ChallengeListResponse;
};

export function MobileGrowthPanel({ memberId, initialChallenges }: MobileGrowthPanelProps) {
  const [streak, setStreak] = useState<DailyStreakResponse | undefined>();
  const [share, setShare] = useState<ShareCreateResponse | undefined>();
  const [referral, setReferral] = useState<ReferralEventResponse | undefined>();
  const [challenges, setChallenges] = useState(initialChallenges);
  const [challengeProgress, setChallengeProgress] = useState<ChallengeJoinResponse | ChallengeCheckInResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  async function loadStreak() {
    await runAction(async () => {
      const response = await fetch(`/api/daily/streak?member_id=${encodeURIComponent(memberId)}&as_of_date=2027-08-16`);
      setStreak(await readJson<DailyStreakResponse>(response, "Streak load failed."));
    });
  }

  async function createShareLanding() {
    await runAction(async () => {
      const response = await fetch("/api/share/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          source_type: "daily_theme",
          source_id: "daily_20270816_life",
          title: "Daily Stargarden card",
          summary: "A light mobile share card for today's reversible observation.",
          keywords: ["Zi Wei", "Hua Lu"],
          safety_flags: ["daily_observation_only"]
        })
      });
      setShare(await readJson<ShareCreateResponse>(response, "Share landing failed."));
    });
  }

  async function recordReferral() {
    if (!share) return;
    await runAction(async () => {
      const response = await fetch("/api/growth/referral-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          share_id: share.snapshot.share_id,
          event_type: "share_opened",
          visitor_id: "visitor_phase13_demo",
          member_id: memberId,
          metadata: {
            surface: "phase13_mobile"
          }
        })
      });
      setReferral(await readJson<ReferralEventResponse>(response, "Referral record failed."));
    });
  }

  async function joinSevenDayChallenge() {
    await runAction(async () => {
      const listResponse = await fetch(`/api/challenge/list?member_id=${encodeURIComponent(memberId)}`);
      setChallenges(await readJson<ChallengeListResponse>(listResponse, "Challenge list failed."));
      const joinResponse = await fetch("/api/challenge/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          challenge_id: "challenge_7_day_stargarden"
        })
      });
      setChallengeProgress(await readJson<ChallengeJoinResponse>(joinResponse, "Challenge join failed."));
    });
  }

  async function checkInSevenDayChallenge() {
    await runAction(async () => {
      const response = await fetch("/api/challenge/check-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          challenge_id: "challenge_7_day_stargarden",
          check_in_ref: "daily_20270816_life"
        })
      });
      const payload = await readJson<ChallengeCheckInResponse>(response, "Challenge check-in failed.");
      setChallengeProgress(payload);
      if (!share) {
        setShare({
          share_url: `/share/${payload.share_snapshot.share_id}`,
          snapshot: payload.share_snapshot,
          privacy: payload.privacy
        });
      }
    });
  }

  async function runAction(action: () => Promise<void>) {
    setIsLoading(true);
    setError(undefined);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Phase 13 action failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="phase13-panel">
      <div className="panel-title-row">
        <Smartphone aria-hidden="true" size={18} />
        <h2>Mobile Growth Console</h2>
      </div>

      <div className="phase13-pwa-card">
        <strong>PWA mobile shell</strong>
        <span>install_state: prompt_available</span>
        <span>offline_fallback: /offline</span>
        <span>revisit_entry: /phase13</span>
      </div>

      <div className="phase13-action-row">
        <button disabled={isLoading} onClick={loadStreak} type="button">
          <CalendarCheck2 aria-hidden="true" size={15} />
          Load streak
        </button>
        <button disabled={isLoading} onClick={createShareLanding} type="button">
          <Share2 aria-hidden="true" size={15} />
          Create share landing
        </button>
        <button disabled={!share || isLoading} onClick={recordReferral} type="button">
          <UserPlus aria-hidden="true" size={15} />
          Record referral
        </button>
        <button disabled={isLoading} onClick={joinSevenDayChallenge} type="button">
          <Trophy aria-hidden="true" size={15} />
          Join 7-day challenge
        </button>
        <button disabled={isLoading} onClick={checkInSevenDayChallenge} type="button">
          <CalendarCheck2 aria-hidden="true" size={15} />
          Challenge check-in
        </button>
      </div>

      <div className="phase13-metric-row">
        <span>available_challenges: {challenges.challenges.length}</span>
        {streak ? <span>current_streak: {streak.streak.current_streak_days}</span> : null}
        {streak?.streak.break_protection_available ? <span>break_protection_available</span> : null}
        {share ? <span>share_landing_ready</span> : null}
        {referral ? <span>referral_recorded</span> : null}
      </div>

      {streak ? (
        <article className="phase13-result-card">
          <strong>{streak.streak.week_theme}</strong>
          <p>{streak.streak.next_recommended_action}</p>
        </article>
      ) : null}

      {share ? (
        <article className="phase13-result-card">
          <strong>{share.snapshot.title}</strong>
          <p>{share.snapshot.summary}</p>
          <a href={share.share_url}>Open share landing</a>
          <div className="phase13-chip-row">
            {share.snapshot.safety_flags.map((flag) => (
              <span key={flag}>{flag}</span>
            ))}
          </div>
        </article>
      ) : null}

      {challengeProgress ? (
        <article className="phase13-result-card">
          <strong>{challengeProgress.progress.challenge_id}</strong>
          <span>progress: {challengeProgress.progress.current_count}/{challengeProgress.progress.target_count}</span>
          <span>{challengeProgress.progress.status}</span>
        </article>
      ) : null}

      {error ? <p className="error-message">{error}</p> : null}
    </section>
  );
}

async function readJson<T extends object>(response: Response, fallback: string): Promise<T> {
  const payload = (await response.json()) as T | { error?: { message?: string } };
  if (!response.ok) {
    throw new Error("error" in payload ? payload.error?.message ?? fallback : fallback);
  }
  return payload as T;
}
