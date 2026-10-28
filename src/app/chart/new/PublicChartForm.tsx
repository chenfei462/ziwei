"use client";

import { CalendarDays, Clock, LocateFixed, ShieldCheck, Sparkles } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import type { BirthProfile, ChartCreateResponse } from "../../../types.js";

const cityCoordinates: Record<string, { longitude: number; latitude: number }> = {
  北京: { longitude: 116.4074, latitude: 39.9042 },
  上海: { longitude: 121.4737, latitude: 31.2304 },
  广州: { longitude: 113.2644, latitude: 23.1291 },
  深圳: { longitude: 114.0579, latitude: 22.5431 },
  成都: { longitude: 104.0668, latitude: 30.5728 },
  杭州: { longitude: 120.1551, latitude: 30.2741 },
  南京: { longitude: 118.7969, latitude: 32.0603 },
  武汉: { longitude: 114.3055, latitude: 30.5928 }
};

export function PublicChartForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [birthTimeKnown, setBirthTimeKnown] = useState(true);
  const [locationKnown, setLocationKnown] = useState(true);

  function fillSampleProfile() {
    const form = formRef.current;
    if (!form) return;
    setBirthTimeKnown(true);
    setLocationKnown(true);
    setInputValue(form, "display_name", "星垣观察者");
    setInputValue(form, "calendar_type", "gregorian");
    setInputValue(form, "birth_date", "2000-08-16");
    setInputValue(form, "birth_time", "03:30");
    setInputValue(form, "location_name", "上海");
    setInputValue(form, "gender_rule", "traditional_unspecified");
    setCheckedValue(form, "true_solar_time_enabled", true);
    setCheckedValue(form, "is_leap_month", false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const locationName = locationKnown ? String(form.get("location_name") || "").trim() : "地点未知";
    const coordinates = locationKnown ? cityCoordinates[locationName] ?? cityCoordinates.上海 : cityCoordinates.上海;
    const profile: BirthProfile = {
      display_name: String(form.get("display_name") || "我的命盘").trim(),
      calendar_type: String(form.get("calendar_type") || "gregorian") as BirthProfile["calendar_type"],
      birth_date: String(form.get("birth_date") || ""),
      birth_time: birthTimeKnown ? String(form.get("birth_time") || "") : "12:00",
      timezone: "Asia/Shanghai",
      location: {
        name: locationName || "上海",
        ...coordinates
      },
      is_leap_month: form.get("is_leap_month") === "on",
      true_solar_time_enabled: form.get("true_solar_time_enabled") === "on",
      gender_rule: String(form.get("gender_rule") || "traditional_unspecified") as BirthProfile["gender_rule"]
    };

    try {
      const response = await fetch("/api/chart/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ birth_profile: profile })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "创建观察卡失败，请检查资料后重试。");
      }
      const chart = payload as ChartCreateResponse;
      window.location.assign(`/chart/${chart.chart_id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建观察卡失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="public-form-card" onSubmit={handleSubmit} ref={formRef}>
      <div className="public-form-grid">
        <label>
          显示名称
          <input autoComplete="name" name="display_name" placeholder="我的星垣观察卡" />
        </label>
        <label>
          历法
          <select name="calendar_type" defaultValue="gregorian">
            <option value="gregorian">公历</option>
            <option value="lunar">农历</option>
          </select>
        </label>
        <label>
          <span className="inline-label">
            <CalendarDays aria-hidden="true" size={15} />
            出生日期
          </span>
          <input name="birth_date" required type="date" />
        </label>
        <label>
          <span className="inline-label">
            <Clock aria-hidden="true" size={15} />
            出生时间
          </span>
          <input disabled={!birthTimeKnown} name="birth_time" required={birthTimeKnown} type="time" />
        </label>
        <label>
          <span className="inline-label">
            <LocateFixed aria-hidden="true" size={15} />
            出生地点
          </span>
          <input autoComplete="address-level2" disabled={!locationKnown} list="city-options" name="location_name" placeholder="上海" required={locationKnown} />
          <datalist id="city-options">
            {Object.keys(cityCoordinates).map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </label>
        <label>
          性别规则
          <select name="gender_rule" defaultValue="traditional_unspecified">
            <option value="traditional_unspecified">暂不指定</option>
            <option value="traditional_male">传统男命</option>
            <option value="traditional_female">传统女命</option>
          </select>
        </label>
      </div>
      <div className="public-check-grid">
        <label className="checkbox-row">
          <input checked={!birthTimeKnown} onChange={(event) => setBirthTimeKnown(!event.currentTarget.checked)} type="checkbox" />
          出生时间未知，先按午时生成并在解读中降低置信度
        </label>
        <label className="checkbox-row">
          <input checked={!locationKnown} onChange={(event) => setLocationKnown(!event.currentTarget.checked)} type="checkbox" />
          出生地点未知，先按默认时区和城市降级生成
        </label>
        <label className="checkbox-row">
          <input name="true_solar_time_enabled" type="checkbox" />
          启用真太阳时口径记录
        </label>
        <label className="checkbox-row">
          <input name="is_leap_month" type="checkbox" />
          农历闰月
        </label>
      </div>
      <div className="public-privacy-callout">
        <ShieldCheck aria-hidden="true" size={18} />
        <p>提交表示你了解：本服务仅供娱乐和自我观察参考，不作为专业决策依据；公开分享不会展示完整出生资料。</p>
      </div>
      {error ? <p className="error-message">{error}</p> : null}
      <div className="public-form-actions">
        <button className="public-secondary-button" onClick={fillSampleProfile} type="button">
          使用演示资料
        </button>
        <button className="public-submit-button" disabled={isSubmitting} type="submit">
          <Sparkles aria-hidden="true" size={18} />
          {isSubmitting ? "生成中" : "生成观察卡"}
        </button>
      </div>
    </form>
  );
}

function setInputValue(form: HTMLFormElement, name: string, value: string): void {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    field.value = value;
  }
}

function setCheckedValue(form: HTMLFormElement, name: string, checked: boolean): void {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement) {
    field.checked = checked;
  }
}
