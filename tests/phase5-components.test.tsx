// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { BetaGrowthPanel } from "../src/components/phase5/BetaGrowthPanel.js";
import { buildChartViewModel } from "../src/phase2/chartViewModel.js";
import { interpret } from "../src/interpret.js";

const chart = createChart({
  birth_profile: {
    display_name: "Beta UI user",
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
  }
});
const viewModel = buildChartViewModel(chart.chart, { selectedPalaceId: "wealth" });
const interpretation = interpret({
  chart_id: chart.chart_id,
  palace_id: "wealth",
  mode: "entertainment",
  include_trace: true
});

describe("internal product signal UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("creates share card, favorite, and report intent from the selected palace", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/ops/product-signals/share-card")) {
        return {
          ok: true,
          json: async () => ({
            share_card_id: "share_ui",
            share_card: {
              title: "Beta share",
              palace_id: "wealth",
              palace_label: "wealth",
              star_keywords: ["star"],
              summary: "Share summary",
              privacy_note: "privacy protected",
              share_text: "Beta share text"
            },
            privacy: { stores_video_frame: false, real_payment_enabled: false }
          })
        } as Response;
      }
      if (url.endsWith("/api/ops/product-signals/favorite")) {
        return {
          ok: true,
          json: async () => ({
            favorite_id: "fav_ui",
            favorite: { palace_id: "wealth" },
            privacy: { stores_video_frame: false }
          })
        } as Response;
      }
      if (url.endsWith("/api/ops/product-signals/report-intent")) {
        return {
          ok: true,
          json: async () => ({
            report_intent_id: "intent_ui",
            report_intent: { tier_id: "standard_49", payment_status: "intent_only" },
            privacy: { real_payment_enabled: false }
          })
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          share_cards_created: 1,
          favorites_saved: 1,
          report_intents: 1
        })
      } as Response;
    });

    render(
      <BetaGrowthPanel
        chartId={chart.chart_id}
        interpretation={interpretation}
        mode="entertainment"
        selectedPalace={viewModel.palaceById.wealth}
        sessionId="session_ui_beta"
      />
    );

    expect(screen.getByRole("heading", { name: "Product Signals" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate share card" }));
    await waitFor(() => expect(screen.getByText(/Share card created/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Save favorite" }));
    await waitFor(() => expect(screen.getByText(/Favorite saved/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Report tier"), { target: { value: "standard_49" } });
    fireEvent.change(screen.getByLabelText("Report interest"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report intent" }));
    await waitFor(() => expect(screen.getByText(/Report intent recorded/)).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ops/product-signals/share-card",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"palace_id":"wealth"')
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ops/product-signals/report-intent",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"tier_id":"standard_49"')
      })
    );
  });
});
