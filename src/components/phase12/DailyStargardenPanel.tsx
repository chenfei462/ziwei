"use client";

import { BookOpen, CalendarDays, CheckCircle2, Sparkles } from "lucide-react";
import { useState } from "react";
import type {
  Achievement,
  AchievementListResponse,
  Chart,
  DailyCheckInResponse,
  DailyThemeResponse,
  InterpretationMode,
  StarAtlasCardResponse,
  StarAtlasListResponse
} from "../../types.js";

type DailyStargardenPanelProps = {
  chartId: string;
  chartSnapshot: Chart;
  memberId: string;
  initialDate: string;
  initialAtlas: StarAtlasListResponse;
  initialAchievements: AchievementListResponse;
};

export function DailyStargardenPanel({
  chartId,
  chartSnapshot,
  memberId,
  initialDate,
  initialAtlas,
  initialAchievements
}: DailyStargardenPanelProps) {
  const [date, setDate] = useState(initialDate);
  const [mode, setMode] = useState<InterpretationMode>("entertainment");
  const [daily, setDaily] = useState<DailyThemeResponse | undefined>();
  const [atlas] = useState(initialAtlas);
  const [achievements, setAchievements] = useState<Achievement[]>(initialAchievements.achievements);
  const [selectedCard, setSelectedCard] = useState<StarAtlasCardResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  async function generateDailyTheme() {
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/daily/theme", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chart_id: chartId,
          chart: chartSnapshot,
          date,
          mode
        })
      });
      const payload = (await response.json()) as DailyThemeResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Daily theme failed.");
      }
      setDaily(payload as DailyThemeResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Daily theme failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function completeDailyQuest() {
    if (!daily || isLoading) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/daily/check-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          daily_theme_id: daily.daily_theme.daily_theme_id,
          member_id: memberId,
          completed_quest_ids: daily.daily_theme.quests.map((quest) => quest.quest_id),
          favorite_star_card_ids: ["star_zi_wei"],
          share_intent: true,
          feedback: "Daily light observation completed.",
          consent: {
            agreed: true,
            no_sensitive_birth_data: true,
            no_video_frame: true
          }
        })
      });
      const payload = (await response.json()) as DailyCheckInResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Daily check-in failed.");
      }
      setAchievements((payload as DailyCheckInResponse).achievements);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Daily check-in failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function openAtlasCard(cardId: string) {
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/star-atlas/${cardId}?member_id=${encodeURIComponent(memberId)}`);
      const payload = (await response.json()) as StarAtlasCardResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Star atlas lookup failed.");
      }
      setSelectedCard(payload as StarAtlasCardResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Star atlas lookup failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="phase12-panel">
      <div className="panel-title-row">
        <Sparkles aria-hidden="true" size={18} />
        <h2>Daily Stargarden Console</h2>
      </div>

      <div className="phase12-control-grid">
        <label>
          Daily date
          <input value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          Daily mode
          <select value={mode} onChange={(event) => setMode(event.target.value as InterpretationMode)}>
            <option value="entertainment">Entertainment</option>
            <option value="professional">Professional</option>
          </select>
        </label>
      </div>

      <div className="phase12-action-row">
        <button disabled={isLoading} onClick={generateDailyTheme} type="button">
          <CalendarDays aria-hidden="true" size={15} />
          Generate daily theme
        </button>
        <button disabled={!daily || isLoading} onClick={completeDailyQuest} type="button">
          <CheckCircle2 aria-hidden="true" size={15} />
          Complete daily quest
        </button>
      </div>

      {daily ? (
        <article className="phase12-daily-card">
          <p className="phase12-kicker">{daily.daily_theme.share_card.version}</p>
          <h3>{daily.daily_theme.title}</h3>
          <p>{daily.daily_theme.summary}</p>
          {daily.daily_theme.seasonal_theme ? <strong>{daily.daily_theme.seasonal_theme.label}</strong> : null}
          <div className="phase12-chip-row">
            <span>{daily.daily_theme.rule_profile_id}</span>
            <span>{daily.daily_theme.rule_version}</span>
            {daily.daily_theme.safety_flags.map((flag) => (
              <span key={flag}>{flag}</span>
            ))}
          </div>
          <div className="phase12-quest-list">
            {daily.daily_theme.quests.map((quest) => (
              <span key={quest.quest_id}>{quest.title}</span>
            ))}
          </div>
        </article>
      ) : null}

      <div className="phase12-atlas-list">
        <div className="panel-title-row">
          <BookOpen aria-hidden="true" size={16} />
          <h2>Star Atlas</h2>
        </div>
        {atlas.cards.slice(0, 8).map((card) => (
          <article key={card.card_id}>
            <strong>{card.label}</strong>
            <span>{card.card_id}</span>
            <span>{card.unlock_status}</span>
            <button onClick={() => openAtlasCard(card.card_id)} type="button">
              Open atlas card {card.card_id}
            </button>
          </article>
        ))}
      </div>

      {selectedCard ? (
        <div className="phase12-node-detail">
          <strong>{selectedCard.card.label}</strong>
          <span>{selectedCard.card.card_id}</span>
          <p>{selectedCard.card.summary}</p>
          <span>{selectedCard.related_knowledge_node_id}</span>
        </div>
      ) : null}

      <div className="phase12-achievement-list">
        {achievements.map((achievement) => (
          <span key={achievement.achievement_id} className={achievement.unlocked ? "phase12-achievement-unlocked" : undefined}>
            {achievement.label}
          </span>
        ))}
      </div>

      {error ? <p className="error-message">{error}</p> : null}
    </section>
  );
}
