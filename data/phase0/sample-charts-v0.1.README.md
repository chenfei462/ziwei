# 样例盘数据集 v0.1 说明

文件：`sample-charts-v0.1.csv`  
阶段：阶段 0「立项与校准」  
用途：作为阶段 1 排盘引擎的测试数据入口。

## 当前状态

当前 CSV 是 30 条「样例盘种子数据」，覆盖普通公历、子时边界、农历闰月、跨时区、真太阳时观察和传统算法字段对照。

重要：这些案例尚未由紫微顾问补齐预期排盘结果，不能直接作为自动化断言。进入阶段 1 前，必须把 `PENDING_CONSULTANT` 字段替换为顾问确认后的结构化结果。

## 字段说明

| 字段 | 说明 |
| --- | --- |
| `case_id` | 样例编号，阶段 1 测试用例 ID |
| `scenario_type` | 覆盖场景分类 |
| `calendar_type` | `gregorian` 或 `lunar` |
| `birth_date` | 出生日期；农历输入时表示农历年月日 |
| `birth_time` | 本地出生时间，24 小时制 |
| `timezone` | IANA 时区 |
| `location_name` | 出生地名称 |
| `longitude` / `latitude` | 出生地经纬度，用于真太阳时或后续校验 |
| `gender_rule` | 传统算法字段，不等同于身份判断 |
| `is_leap_month` | 农历输入是否闰月 |
| `true_solar_time_enabled` | 是否启用真太阳时观察 |
| `zi_hour_day_boundary` | 子时换日默认口径 |
| `leap_month_policy` | 闰月默认口径 |
| `expected_palaces` | 顾问确认的命身宫与十二宫结果 |
| `expected_major_stars` | 顾问确认的十四主星落宫结果 |
| `expected_transforms` | 顾问确认的四化结果 |
| `expected_major_periods` | 顾问确认的大限结果 |
| `consultant_notes` | 顾问备注、口径差异、特殊说明 |
| `validation_status` | 当前校验状态 |

## 顾问填写格式建议

顾问可先在表格中填写文字版结果，工程师再转为 JSON。阶段 1 自动化测试建议使用以下结构：

```json
{
  "life_palace": "子",
  "body_palace": "辰",
  "palaces": [
    {
      "name": "命宫",
      "branch": "子",
      "stem": "甲"
    }
  ]
}
```

主星字段建议结构：

```json
{
  "紫微": "命宫",
  "天机": "兄弟宫",
  "太阳": "夫妻宫"
}
```

四化字段建议结构：

```json
[
  {
    "type": "化禄",
    "star": "示例星曜",
    "palace": "财帛宫",
    "source_stem": "甲"
  }
]
```

大限字段建议结构：

```json
[
  {
    "age_start": 2,
    "age_end": 11,
    "palace": "命宫",
    "direction": "clockwise"
  }
]
```

## 阶段 1 准入标准

- 至少 20 条样例的 `expected_*` 字段已由顾问确认。
- 子时、闰月、跨时区、真太阳时观察四类案例至少各有 2 条可用于断言。
- `validation_status` 从 `seed_needs_consultant` 更新为 `consultant_approved`。
- 算法工程师把顾问结果转换为可解析 JSON，并写入测试工程。
