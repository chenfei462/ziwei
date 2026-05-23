"use client";

import { CalendarDays, Clock, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import type { BirthProfile } from "../../types.js";

type BirthProfileFormProps = {
  isLoading: boolean;
  onSubmit: (profile: BirthProfile) => void;
};

export function BirthProfileForm({ isLoading, onSubmit }: BirthProfileFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      display_name: String(form.get("display_name") || "演示用户"),
      calendar_type: String(form.get("calendar_type") || "gregorian") as BirthProfile["calendar_type"],
      birth_date: String(form.get("birth_date") || "2000-08-16"),
      birth_time: String(form.get("birth_time") || "03:30"),
      timezone: String(form.get("timezone") || "Asia/Shanghai"),
      location: {
        name: String(form.get("location_name") || "上海"),
        longitude: 121.4737,
        latitude: 31.2304
      },
      is_leap_month: form.get("is_leap_month") === "on",
      true_solar_time_enabled: false,
      gender_rule: String(form.get("gender_rule") || "traditional_unspecified") as BirthProfile["gender_rule"]
    });
  }

  return (
    <form className="input-panel" onSubmit={handleSubmit}>
      <div className="panel-title-row">
        <Sparkles aria-hidden="true" size={18} />
        <h2>建档开盘</h2>
      </div>
      <label>
        显示名
        <input name="display_name" defaultValue="演示用户" autoComplete="off" />
      </label>
      <div className="form-grid">
        <label>
          日历
          <select name="calendar_type" defaultValue="gregorian">
            <option value="gregorian">公历</option>
            <option value="lunar">农历</option>
          </select>
        </label>
        <label>
          传统算法字段
          <select name="gender_rule" defaultValue="traditional_unspecified">
            <option value="traditional_unspecified">不指定</option>
            <option value="traditional_male">传统男</option>
            <option value="traditional_female">传统女</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          <span className="inline-label">
            <CalendarDays aria-hidden="true" size={15} />
            出生日期
          </span>
          <input name="birth_date" type="date" defaultValue="2000-08-16" />
        </label>
        <label>
          <span className="inline-label">
            <Clock aria-hidden="true" size={15} />
            出生时间
          </span>
          <input name="birth_time" type="time" defaultValue="03:30" />
        </label>
      </div>
      <div className="form-grid">
        <label>
          时区
          <input name="timezone" defaultValue="Asia/Shanghai" />
        </label>
        <label>
          地点
          <input name="location_name" defaultValue="上海" />
        </label>
      </div>
      <label className="checkbox-row">
        <input name="is_leap_month" type="checkbox" />
        农历闰月
      </label>
      <button className="primary-action" disabled={isLoading} type="submit">
        <Sparkles aria-hidden="true" size={17} />
        {isLoading ? "开盘中" : "开盘"}
      </button>
    </form>
  );
}
