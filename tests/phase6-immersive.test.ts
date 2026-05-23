import { beforeEach, describe, expect, test } from "vitest";
import { createChart } from "../src/chartEngine.js";
import {
  createImmersiveSession,
  detectARCapability,
  getImmersiveSession,
  mapImmersiveGesture,
  recordStageEvent,
  summarizeImmersiveSession
} from "../src/phase6/immersive.js";
import { clearChartsForTests, clearImmersiveForTests } from "../src/store.js";
import type { BirthProfile } from "../src/types.js";

const birthProfile: BirthProfile = {
  display_name: "Immersive user",
  calendar_type: "gregorian",
  birth_date: "2000-08-16",
  birth_time: "03:30",
  timezone: "Asia/Shanghai",
  location: {
    name: "Shanghai",
    longitude: 121.4737,
    latitude: 31.2304
  },
  is_leap_month: false,
  true_solar_time_enabled: false,
  gender_rule: "traditional_male"
};

describe("phase 6 immersive session core", () => {
  beforeEach(() => {
    clearChartsForTests();
    clearImmersiveForTests();
  });

  test("creates a short-lived stage session without sensitive birth or camera data", () => {
    const chart = createChart({ birth_profile: birthProfile });
    const response = createImmersiveSession({
      chart_id: chart.chart_id,
      display_mode: "stage_screen",
      ttl_minutes: 30,
      controller_label: "Host tablet"
    });
    const serialized = JSON.stringify(response);

    expect(response.session.session_id).toMatch(/^immersive_/);
    expect(response.session.short_code).toMatch(/^[A-Z0-9]{6}$/);
    expect(response.session.display_mode).toBe("stage_screen");
    expect(response.session.active_layer).toBe("main");
    expect(response.session.privacy).toMatchObject({
      hides_full_birth_date: true,
      hides_birth_time: true,
      hides_location_detail: true,
      stores_video_frame: false
    });
    expect(serialized).not.toContain("2000-08-16");
    expect(serialized).not.toContain("03:30");
    expect(serialized).not.toContain("Shanghai");
    expect(serialized).not.toContain("data:image/");
  });

  test("records sanitized stage events and updates selected palace, layers, periods, and immersive gestures", () => {
    const chart = createChart({ birth_profile: birthProfile });
    const { session } = createImmersiveSession({ chart_id: chart.chart_id, display_mode: "stage_screen" });

    const selected = recordStageEvent(session.session_id, {
      type: "select_palace",
      target_palace_id: "wealth",
      confidence: 0.96,
      note: "select 2000-08-16 03:30 in Shanghai"
    });
    const layer = recordStageEvent(session.session_id, { type: "cycle_layer", confidence: 0.91 });
    const period = recordStageEvent(session.session_id, { type: "cycle_major_period", confidence: 0.9 });
    const panorama = recordStageEvent(session.session_id, mapImmersiveGesture("two_hand_spread", 0.94));
    const toggle = recordStageEvent(session.session_id, mapImmersiveGesture("palm_flip", 0.93));

    expect(selected.event.note).toContain("[birth_date_redacted]");
    expect(selected.event.note).toContain("[birth_time_redacted]");
    expect(layer.session.active_layer).toBe("support");
    expect(period.session.active_major_period_index).toBe(1);
    expect(panorama.session.is_panorama).toBe(true);
    expect(toggle.session.interpretation_mode).toBe("entertainment");
    expect(getImmersiveSession(session.session_id)?.active_palace_id).toBe("wealth");
    expect(JSON.stringify(selected)).not.toContain("Shanghai");
  });

  test("summarizes immersive event latency targets and detects AR fallback capability", () => {
    const chart = createChart({ birth_profile: birthProfile });
    const { session } = createImmersiveSession({ chart_id: chart.chart_id, display_mode: "ar_mobile" });
    recordStageEvent(session.session_id, { type: "select_palace", target_palace_id: "life", confidence: 0.95 });

    const summary = summarizeImmersiveSession(session.session_id);
    const fallback = detectARCapability({
      webxr_supported: false,
      camera_permission: "denied",
      device_type: "mobile"
    });

    expect(summary.session_id).toBe(session.session_id);
    expect(summary.event_count).toBe(1);
    expect(summary.performance_targets).toMatchObject({
      sync_latency_ms: 250,
      ar_startup_ms: 3000
    });
    expect(fallback.status).toBe("fallback");
    expect(fallback.fallback_mode).toBe("manual_panorama");
    expect(fallback.no_video_frame).toBe(true);
  });
});
