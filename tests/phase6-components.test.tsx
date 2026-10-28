// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createChart } from "../src/chartEngine.js";
import { createImmersiveSession } from "../src/phase6/immersive.js";
import { StageScreen } from "../src/components/phase6/StageScreen.js";
import { MobileController } from "../src/components/phase6/MobileController.js";
import { ARPreview } from "../src/components/phase6/ARPreview.js";

const chart = createChart({
  birth_profile: {
    display_name: "Component immersive user",
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
const stageSession = createImmersiveSession({ chart_id: chart.chart_id, display_mode: "stage_screen" }).session;

describe("phase 6 immersive UI components", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("stage screen renders a 16:9 display, privacy notice, and no full birth details", () => {
    render(<StageScreen chart={chart} session={stageSession} />);

    expect(screen.getByRole("heading", { name: "Stage Screen" })).toBeInTheDocument();
    expect(screen.getByTestId("stage-screen-frame")).toHaveClass("stage-screen-frame");
    expect(screen.getByText(/full birth date hidden/i)).toBeInTheDocument();
    expect(screen.queryByText("2000-08-16")).not.toBeInTheDocument();
    expect(screen.queryByText("03:30")).not.toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
  });

  test("mobile controller sends stage events with a selected palace and fallback buttons", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        session: { ...stageSession, active_palace_id: "wealth" },
        event: { type: "select_palace" },
        privacy: { stores_video_frame: false }
      })
    } as Response);

    render(<MobileController session={stageSession} />);

    fireEvent.change(screen.getByLabelText("Target palace"), { target: { value: "wealth" } });
    fireEvent.click(screen.getByRole("button", { name: "Select palace" }));

    await waitFor(() => expect(screen.getByText(/Event sent/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/ops/immersive/session/${stageSession.session_id}/event`,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"target_palace_id":"wealth"')
      })
    );
  });

  test("AR preview falls back to manual panorama when camera or WebXR is unavailable", () => {
    render(
      <ARPreview
        chart={chart}
        session={{ ...stageSession, display_mode: "ar_mobile" }}
        capability={{
          status: "fallback",
          webxr_supported: false,
          camera_permission: "denied",
          device_type: "mobile",
          fallback_mode: "manual_panorama",
          no_video_frame: true
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "AR Preview" })).toBeInTheDocument();
    expect(screen.getByText(/Manual panorama fallback/)).toBeInTheDocument();
    expect(screen.getAllByText(/no video frame/i).length).toBeGreaterThan(0);
  });
});
