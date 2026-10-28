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
  variant?: "internal" | "public";
};

export function DailyStargardenPanel({
  chartId,
  chartSnapshot,
  memberId,
  initialDate,
  initialAtlas,
  initialAchievements,
  variant = "internal"
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

  const copy = variant === "public" ? publicCopy : internalCopy;

  return (
    <section className="phase12-panel" aria-label={copy.title}>
      <div className="panel-title-row">
        <Sparkles aria-hidden="true" size={18} />
        <h2>{copy.title}</h2>
      </div>

      <div className="phase12-control-grid">
        <label>
          {copy.dateLabel}
          <input value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          {copy.modeLabel}
          <select value={mode} onChange={(event) => setMode(event.target.value as InterpretationMode)}>
            <option value="entertainment">{copy.entertainmentLabel}</option>
            <option value="professional">{copy.professionalLabel}</option>
          </select>
        </label>
      </div>

      <div className="phase12-action-row">
        <button disabled={isLoading} onClick={generateDailyTheme} type="button">
          <CalendarDays aria-hidden="true" size={15} />
          {copy.generateButton}
        </button>
        <button disabled={!daily || isLoading} onClick={completeDailyQuest} type="button">
          <CheckCircle2 aria-hidden="true" size={15} />
          {copy.completeButton}
        </button>
      </div>

      {daily ? (
        <article className="phase12-daily-card">
          <p className="phase12-kicker">{daily.daily_theme.share_card.version}</p>
          <h3>{daily.daily_theme.title}</h3>
          <p>{daily.daily_theme.summary}</p>
          {daily.daily_theme.seasonal_theme ? <strong>{daily.daily_theme.seasonal_theme.label}</strong> : null}
          <div className="phase12-chip-row">
            {dailyThemeChips(daily.daily_theme, variant).map((chip) => (
              <span key={chip}>{chip}</span>
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
          <h2>{copy.atlasTitle}</h2>
        </div>
        {atlas.cards.slice(0, 8).map((card) => {
          const cardLabel = atlasCardLabel(card, variant);
          return (
            <article key={card.card_id}>
              <strong>{cardLabel}</strong>
              {variant === "internal" ? <span>{card.card_id}</span> : null}
              <span>{variant === "public" ? atlasStatusLabel(card.unlock_status) : card.unlock_status}</span>
              <button onClick={() => openAtlasCard(card.card_id)} type="button">
                {copy.openAtlasButton(cardLabel, card)}
              </button>
            </article>
          );
        })}
      </div>

      {selectedCard ? (
        <div className="phase12-node-detail">
          <strong>{atlasCardLabel(selectedCard.card, variant)}</strong>
          {variant === "internal" ? <span>{selectedCard.card.card_id}</span> : null}
          <p>{variant === "public" ? atlasSummary(selectedCard.card) : selectedCard.card.summary}</p>
          {variant === "internal" ? <span>{selectedCard.related_knowledge_node_id}</span> : null}
        </div>
      ) : null}

      <div className="phase12-achievement-list">
        {achievements.map((achievement) => (
          <span key={achievement.achievement_id} className={achievement.unlocked ? "phase12-achievement-unlocked" : undefined}>
            {variant === "public" ? achievementLabel(achievement) : achievement.label}
          </span>
        ))}
      </div>

      {error ? <p className="error-message">{error}</p> : null}
    </section>
  );
}

const internalCopy = {
  title: "Daily Stargarden Console",
  dateLabel: "Daily date",
  modeLabel: "Daily mode",
  entertainmentLabel: "Entertainment",
  professionalLabel: "Professional",
  generateButton: "Generate daily theme",
  completeButton: "Complete daily quest",
  atlasTitle: "Star Atlas",
  openAtlasButton: (_label: string, card: StarAtlasListResponse["cards"][number]) => `Open atlas card ${card.card_id}`
};

const publicCopy = {
  title: "今日星垣卡",
  dateLabel: "观察日期",
  modeLabel: "解读口径",
  entertainmentLabel: "轻量观察",
  professionalLabel: "结构解读",
  generateButton: "生成今日星垣卡",
  completeButton: "完成今日观察",
  atlasTitle: "星垣卡图谱",
  openAtlasButton: (label: string) => `查看${label}卡`
};

const publicAtlasLabels: Record<string, string> = {
  star_zi_wei: "紫微",
  star_tian_ji: "天机",
  star_tai_yang: "太阳",
  star_wu_qu: "武曲",
  star_tian_tong: "天同",
  star_lian_zhen: "廉贞",
  star_tian_fu: "天府",
  star_tai_yin: "太阴",
  star_tan_lang: "贪狼",
  star_ju_men: "巨门",
  star_tian_xiang: "天相",
  star_tian_liang: "天梁",
  star_qi_sha: "七杀",
  star_po_jun: "破军",
  transform_lu: "化禄",
  transform_quan: "化权",
  transform_ke: "化科",
  transform_ji: "化忌",
  pattern_sanfang_sizheng: "三方四正"
};

const publicAtlasSummaries: Record<string, string> = {
  star_zi_wei: "聚焦自我定位、结构感和当日主轴。",
  star_tian_ji: "适合观察计划、调整和移动中的选择。",
  star_tai_yang: "适合观察可见责任、表达和主动承担。",
  star_wu_qu: "适合观察资源分配、执行节奏和取舍。",
  star_tian_tong: "适合观察恢复、缓冲和情绪节奏。",
  star_lian_zhen: "适合观察边界、标准和关系中的尺度。",
  star_tian_fu: "适合观察储备、照管和资源承接。",
  star_tai_yin: "适合观察内在支持、复盘和细腻感受。",
  star_tan_lang: "适合观察探索欲、社交拉力和兴趣分散。",
  star_ju_men: "适合观察表达、验证和沟通中的误差。",
  star_tian_xiang: "适合观察协调、服务和协作位置。",
  star_tian_liang: "适合观察原则、保护和长期判断。",
  star_qi_sha: "适合观察决断、变化和行动边界。",
  star_po_jun: "适合观察重置、拆解和重新搭建。",
  transform_lu: "适合观察资源流入、吸引力和舒适区。",
  transform_quan: "适合观察行动压力、主导感和责任分配。",
  transform_ke: "适合观察学习、记录和外部评价。",
  transform_ji: "适合观察卡点、照护和需要慢下来的部分。",
  pattern_sanfang_sizheng: "适合观察一个主题背后的关联结构。"
};

function dailyThemeChips(theme: DailyThemeResponse["daily_theme"], variant: "internal" | "public"): string[] {
  if (variant === "internal") return [theme.rule_profile_id, theme.rule_version, ...theme.safety_flags];
  const chips = new Set<string>(["规则可追溯"]);
  for (const flag of theme.safety_flags) chips.add(safetyFlagLabel(flag));
  return Array.from(chips);
}

function safetyFlagLabel(flag: string): string {
  if (flag.includes("daily")) return "仅自我观察";
  if (flag.includes("absolute")) return "避免绝对化";
  if (flag.includes("major")) return "重大决策提醒";
  if (flag.includes("privacy")) return "隐私脱敏";
  return "内容安全过滤";
}

function atlasCardLabel(card: StarAtlasListResponse["cards"][number], variant: "internal" | "public"): string {
  if (variant === "internal") return card.label;
  return publicAtlasLabels[card.card_id] ?? card.label;
}

function atlasStatusLabel(status: StarAtlasListResponse["cards"][number]["unlock_status"]): string {
  return status === "unlocked" ? "已开放观察" : "完成观察后解锁";
}

function atlasSummary(card: StarAtlasListResponse["cards"][number]): string {
  return publicAtlasSummaries[card.card_id] ?? "用于把传统星曜语义转成一条低风险的当日观察提示。";
}

function achievementLabel(achievement: Achievement): string {
  if (achievement.achievement_id === "achievement_daily_first_checkin") return "首次完成今日观察";
  if (achievement.achievement_id === "achievement_three_daily_quests") return "连续观察节奏";
  if (achievement.achievement_id === "achievement_star_atlas_reader") return "已查看星垣卡";
  if (achievement.achievement_id === "achievement_daily_share_intent") return "适合脱敏分享";
  return achievement.label;
}
