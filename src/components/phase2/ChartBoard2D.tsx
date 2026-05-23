"use client";

import type { KeyboardEvent } from "react";
import type { ChartViewModel, PalaceViewModel, RelationKind, StarLayer } from "../../phase2/types.js";
import { getPalaceBackgroundHref } from "./palaceBackgrounds.js";

type ChartBoard2DProps = {
  viewModel: ChartViewModel;
  selectedPalaceId: string | undefined;
  activeLayer: StarLayer;
  onSelectPalace: (palaceId: string) => void;
};

const relationLabel: Record<RelationKind, string> = {
  selected: "本宫",
  opposite: "对宫",
  triad: "三合",
  neighbor: "邻宫",
  inactive: ""
};

export function ChartBoard2D({ viewModel, selectedPalaceId, activeLayer, onSelectPalace }: ChartBoard2DProps) {
  return (
    <section className="chart-shell" aria-label="十二宫星盘">
      <svg data-testid="chart-board" className="chart-board" viewBox="0 0 840 760" role="img" aria-label="2D 十二宫星盘">
        <rect x="278" y="238" width="284" height="244" rx="8" className="center-field" />
        <text x="420" y="312" className="center-title">
          紫微星垣
        </text>
        <text x="420" y="350" className="center-subtitle">
          {selectedPalaceId ? "关系高亮" : "全局视图"}
        </text>
        <text x="420" y="386" className="center-layer">
          {activeLayer === "main" ? "主星层" : activeLayer === "support" ? "辅曜层" : "四化层"}
        </text>
        {viewModel.palaces.map((palace) => (
          <PalaceTile key={palace.palace_id} palace={palace} onSelectPalace={onSelectPalace} />
        ))}
      </svg>
    </section>
  );
}

function PalaceTile({ palace, onSelectPalace }: { palace: PalaceViewModel; onSelectPalace: (palaceId: string) => void }) {
  const backgroundHref = getPalaceBackgroundHref(palace.label);
  const clipPathId = `palace-clip-${palace.palace_id}`;
  const titleShadeId = `palace-title-shade-${palace.palace_id}`;

  function handleKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectPalace(palace.palace_id);
    }
  }

  return (
    <g
      data-testid="palace-tile"
      role="button"
      tabIndex={0}
      aria-label={`${palace.label} ${relationLabel[palace.relationKind]}`}
      className={`palace-tile relation-${palace.relationKind}`}
      onClick={() => onSelectPalace(palace.palace_id)}
      onKeyDown={handleKeyDown}
    >
      <defs>
        <clipPath id={clipPathId}>
          <rect x={palace.position.x} y={palace.position.y} width={palace.position.width} height={palace.position.height} rx="8" />
        </clipPath>
        <linearGradient id={titleShadeId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(8, 10, 9, 0.84)" />
          <stop offset="34%" stopColor="rgba(10, 12, 11, 0.68)" />
          <stop offset="100%" stopColor="rgba(10, 12, 11, 0.18)" />
        </linearGradient>
      </defs>
      {backgroundHref ? (
        <image
          data-testid="palace-background-image"
          className="palace-bg-image"
          href={backgroundHref}
          x={palace.position.x}
          y={palace.position.y}
          width={palace.position.width}
          height={palace.position.height}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipPathId})`}
        />
      ) : null}
      <rect className="palace-bg-scrim" x={palace.position.x} y={palace.position.y} width={palace.position.width} height={palace.position.height} rx="8" />
      <rect
        className="palace-title-shade"
        x={palace.position.x}
        y={palace.position.y}
        width={palace.position.width}
        height={palace.position.height}
        rx="8"
        fill={`url(#${titleShadeId})`}
      />
      <rect className="palace-frame" x={palace.position.x} y={palace.position.y} width={palace.position.width} height={palace.position.height} rx="8" />
      <text x={palace.position.x + 16} y={palace.position.y + 30} className="palace-name">
        {palace.label}
      </text>
      <text x={palace.position.x + 16} y={palace.position.y + 56} className="palace-branch">
        {palace.stem}
        {palace.branch}
      </text>
      {palace.displayStars.slice(0, 3).map((star, index) => (
        <text key={`${palace.palace_id}-${star}-${index}`} x={palace.position.x + 16} y={palace.position.y + 84 + index * 18} className="palace-star">
          {star}
        </text>
      ))}
      {palace.relationKind !== "inactive" ? (
        <text x={palace.position.x + 94} y={palace.position.y + 30} className="relation-chip">
          {relationLabel[palace.relationKind]}
        </text>
      ) : null}
    </g>
  );
}
