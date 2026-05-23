# API 草案冻结版 v0.1

项目：紫微斗数互动项目  
阶段：阶段 0「立项与校准」  
版本：v0.1  
日期：2026-04-30

## 1. 设计目标

本文件只冻结阶段 1「排盘引擎」需要对齐的接口意图和数据形状，不要求阶段 0 实现服务端代码。

接口设计原则：

- 排盘结果必须结构化，不能只返回文案。
- 原始输入、中间口径和最终结果必须可追踪。
- 专业模式与娱乐模式共用同一个 `chart_id` 和底层 `Chart`。
- 敏感出生资料不得出现在分享输出中。

## 2. 通用约定

### 错误结构

```json
{
  "error": {
    "code": "INVALID_BIRTH_TIME",
    "message": "出生时间格式无效。",
    "field": "birth_time",
    "request_id": "req_20260430_000001"
  }
}
```

### 枚举

```json
{
  "calendar_type": ["gregorian", "lunar"],
  "gender_rule": ["traditional_male", "traditional_female", "traditional_unspecified"],
  "interpretation_mode": ["professional", "entertainment"],
  "confidence": ["strong_structure", "medium_structure", "weak_structure"]
}
```

## 3. POST /api/chart/create

根据出生档案生成命盘。

### Request

```json
{
  "birth_profile": {
    "display_name": "示例用户",
    "calendar_type": "gregorian",
    "birth_date": "1992-08-18",
    "birth_time": "23:35",
    "timezone": "Asia/Shanghai",
    "location": {
      "name": "上海",
      "longitude": 121.4737,
      "latitude": 31.2304
    },
    "is_leap_month": false,
    "true_solar_time_enabled": false,
    "gender_rule": "traditional_unspecified"
  },
  "rule_config": {
    "school_id": "default_ziwei_v0_1",
    "zi_hour_day_boundary": "civil_midnight",
    "leap_month_policy": "same_month_number"
  }
}
```

### Response

```json
{
  "chart_id": "chart_20260430_000001",
  "rule_config_used": {
    "school_id": "default_ziwei_v0_1",
    "zi_hour_day_boundary": "civil_midnight",
    "leap_month_policy": "same_month_number"
  },
  "normalized_birth": {
    "calendar_type": "gregorian",
    "solar_date": "1992-08-18",
    "local_time": "23:35",
    "timezone": "Asia/Shanghai",
    "true_solar_time_applied": false
  },
  "chart": {
    "palaces": [],
    "stars": [],
    "transforms": [],
    "major_periods": []
  },
  "warnings": [
    {
      "code": "CONSULTANT_SAMPLE_REQUIRED",
      "message": "该口径需要使用样例盘持续校验。"
    }
  ]
}
```

## 4. GET /api/chart/{id}

读取命盘结构与星曜列表。

### Response

```json
{
  "chart_id": "chart_20260430_000001",
  "created_at": "2026-04-30T10:00:00+08:00",
  "chart": {
    "palaces": [
      {
        "palace_id": "life",
        "name": "命宫",
        "branch": "子",
        "stem": "甲",
        "main_stars": ["紫微"],
        "support_stars": ["左辅"],
        "transforms": [],
        "strength_score": null,
        "relation_refs": {
          "opposite": "migration",
          "triad": ["career", "wealth"],
          "neighbors": ["parents", "siblings"]
        }
      }
    ],
    "stars": [
      {
        "name": "紫微",
        "category": "major",
        "palace_id": "life",
        "element": null,
        "brightness": null,
        "tags": ["leadership", "structure"]
      }
    ],
    "transforms": [
      {
        "type": "hua_lu",
        "star": "示例星曜",
        "source_stem": "甲",
        "palace_id": "wealth"
      }
    ],
    "major_periods": [
      {
        "period_id": "major_001",
        "age_start": 2,
        "age_end": 11,
        "palace_id": "life",
        "direction": "clockwise"
      }
    ]
  },
  "privacy": {
    "share_birth_date": false,
    "share_birth_time": false,
    "share_location": false
  }
}
```

## 5. POST /api/interpret

输入宫位、模式和限运上下文，返回专业或娱乐解读。

### Request

```json
{
  "chart_id": "chart_20260430_000001",
  "palace_id": "career",
  "mode": "professional",
  "time_context": {
    "type": "natal",
    "major_period_id": null,
    "year": null
  },
  "include_trace": true
}
```

### Response

```json
{
  "chart_id": "chart_20260430_000001",
  "palace_id": "career",
  "mode": "professional",
  "interpretation": {
    "basis": "官禄宫主题结合主星、三方四正和四化结果。",
    "interpretation": "职业主题以职责、组织位置和长期规划为观察重点。",
    "scenario": "适合观察自己在团队中的职责承担方式。",
    "advice": "优先把目标拆成可执行计划，避免用单一结论判断职业走向。",
    "confidence": "medium_structure",
    "safety_flags": ["avoid_absolute_prediction"]
  },
  "trace": [
    {
      "rule_id": "STRUCTURE-SFSZ-001",
      "source_id": "source_doushu_fawei",
      "trigger": "palace + opposite + triad",
      "weight": 0.25
    }
  ]
}
```

## 6. 阶段 1 不实现的接口

以下接口只保留产品方向，不进入阶段 1：

- `/api/report/export`
- `/api/gesture/event`
- `/api/compatibility/create`
- `/api/payment/*`
- `/api/admin/knowledge-base/*`

## 7. 验收要求

- `POST /api/chart/create` 的请求字段必须覆盖样例盘 CSV 的出生资料字段。
- `GET /api/chart/{id}` 的响应必须支持 2D 十二宫星盘渲染。
- `POST /api/interpret` 的响应必须能同时服务专业模式和娱乐模式。
- 所有接口响应不得默认暴露完整出生日期、出生时间和出生地点。
- 任何文案输出都必须包含置信等级或安全标记。
