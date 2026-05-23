// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createChart } from "../src/index.js";
import { BirthProfileForm } from "../src/components/phase2/BirthProfileForm.js";
import { ChartBoard2D } from "../src/components/phase2/ChartBoard2D.js";
import { GestureController } from "../src/components/phase2/GestureController.js";
import { GestureLogPanel } from "../src/components/phase2/GestureLogPanel.js";
import { PalaceCard } from "../src/components/phase2/PalaceCard.js";
import { buildChartViewModel } from "../src/phase2/chartViewModel.js";
import { createGestureEventLog } from "../src/phase2/interactionState.js";

const chart = createChart({
  birth_profile: {
    display_name: "组件测试用户",
    calendar_type: "gregorian",
    birth_date: "2000-08-16",
    birth_time: "03:30",
    timezone: "Asia/Shanghai",
    location: {
      name: "上海",
      longitude: 121.4737,
      latitude: 31.2304
    },
    is_leap_month: false,
    true_solar_time_enabled: false,
    gender_rule: "traditional_male"
  }
});
const viewModel = buildChartViewModel(chart.chart);
const palaceBackgroundsByLabel: Record<string, string> = {
  命宫: "/palace-backgrounds/01-life.png",
  兄弟宫: "/palace-backgrounds/02-siblings.png",
  夫妻宫: "/palace-backgrounds/03-partnership.png",
  子女宫: "/palace-backgrounds/04-children.png",
  财帛宫: "/palace-backgrounds/05-wealth.png",
  疾厄宫: "/palace-backgrounds/06-health.png",
  迁移宫: "/palace-backgrounds/07-travel.png",
  仆役宫: "/palace-backgrounds/08-allies.png",
  官禄宫: "/palace-backgrounds/09-career.png",
  田宅宫: "/palace-backgrounds/10-property.png",
  福德宫: "/palace-backgrounds/11-fortune.png",
  父母宫: "/palace-backgrounds/12-parents.png"
};

describe("phase 2 React components", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the birth profile form with the planned fallback submit path", () => {
    render(<BirthProfileForm isLoading={false} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("出生日期")).toBeInTheDocument();
    expect(screen.getByLabelText("出生时间")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /开盘/ })).toBeInTheDocument();
  });

  test("renders a non-empty 12-palace SVG board and handles palace selection", () => {
    const onSelect = vi.fn();
    render(<ChartBoard2D activeLayer="main" onSelectPalace={onSelect} selectedPalaceId={undefined} viewModel={viewModel} />);

    expect(screen.getByTestId("chart-board")).toBeInTheDocument();
    expect(screen.getAllByTestId("palace-tile")).toHaveLength(12);
    viewModel.palaces.forEach((palace) => {
      const tile = screen.getByRole("button", { name: new RegExp(palace.label) });
      const backgroundImage = tile.querySelector('[data-testid="palace-background-image"]');

      expect(backgroundImage).not.toBeNull();
      expect(backgroundImage?.getAttribute("href")).toBe(palaceBackgroundsByLabel[palace.label]);
    });

    fireEvent.click(screen.getAllByTestId("palace-tile")[0]);
    expect(onSelect).toHaveBeenCalledWith(viewModel.palaces[0].palace_id);
  });

  test("renders palace card placeholders without formal interpretation", () => {
    render(<PalaceCard activeLayer="main" palace={viewModel.palaces[0]} />);

    expect(screen.getByText(/结构化占位/)).toBeInTheDocument();
    expect(screen.getByText(/正式解读将在阶段 3 接入/)).toBeInTheDocument();
  });

  test("renders gesture logs without any frame or image payload", () => {
    const log = createGestureEventLog("open_palm", 0.96, "reset_view");
    render(<GestureLogPanel logs={[log]} />);

    expect(screen.getByText("open_palm")).toBeInTheDocument();
    expect(screen.getByText(/no_video_frame/)).toBeInTheDocument();
    expect(screen.getByText("simulation")).toBeInTheDocument();
    expect(screen.queryByText(/image|base64/i)).not.toBeInTheDocument();
  });

  test("renders readable gesture simulation buttons", () => {
    render(<GestureController targetPalaceId="life" selectedPalaceId={undefined} onGesture={vi.fn()} />);

    expect(screen.getByRole("button", { name: /模拟开掌/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /模拟点选/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /模拟捏合/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /模拟画圈/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /模拟握拳/ })).toBeInTheDocument();
  });

  test("point simulation emits a fallback target when no palace is selected", () => {
    const onGesture = vi.fn();
    render(<GestureController targetPalaceId="life" selectedPalaceId={undefined} onGesture={onGesture} />);

    fireEvent.click(screen.getByRole("button", { name: /模拟点选/ }));

    expect(onGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "point",
        action: "select_palace",
        target_palace_id: "life",
        source: "simulation"
      })
    );
  });
});
