"use client";

import type { StarLayer } from "../../phase2/types.js";

type ModeTabsProps = {
  activeLayer: StarLayer;
  onLayerChange: (layer: StarLayer) => void;
};

const layers: Array<{ id: StarLayer; label: string }> = [
  { id: "main", label: "主星" },
  { id: "support", label: "辅曜" },
  { id: "transforms", label: "四化" }
];

export function ModeTabs({ activeLayer, onLayerChange }: ModeTabsProps) {
  return (
    <div className="segmented-control" role="tablist" aria-label="星曜层级">
      {layers.map((layer) => (
        <button key={layer.id} role="tab" aria-selected={activeLayer === layer.id} onClick={() => onLayerChange(layer.id)}>
          {layer.label}
        </button>
      ))}
    </div>
  );
}
