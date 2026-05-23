import { ApiError } from "./errors.js";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function timeIndexFromBirthTime(birthTime: string): number {
  const match = timePattern.exec(birthTime);
  if (!match) {
    throw new ApiError("INVALID_BIRTH_TIME", "出生时间格式无效。", { field: "birth_time" });
  }

  const hour = Number(match[1]);

  if (hour === 23) return 12;
  if (hour === 0) return 0;
  if (hour >= 1 && hour <= 2) return 1;
  if (hour >= 3 && hour <= 4) return 2;
  if (hour >= 5 && hour <= 6) return 3;
  if (hour >= 7 && hour <= 8) return 4;
  if (hour >= 9 && hour <= 10) return 5;
  if (hour >= 11 && hour <= 12) return 6;
  if (hour >= 13 && hour <= 14) return 7;
  if (hour >= 15 && hour <= 16) return 8;
  if (hour >= 17 && hour <= 18) return 9;
  if (hour >= 19 && hour <= 20) return 10;
  return 11;
}

export function normalizeDateForIztro(input: string): string {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  if (!match) {
    throw new ApiError("INVALID_BIRTH_DATE", "出生日期格式无效。", { field: "birth_date" });
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new ApiError("INVALID_BIRTH_DATE", "出生日期超出有效范围。", { field: "birth_date" });
  }

  return `${year}-${month}-${day}`;
}
