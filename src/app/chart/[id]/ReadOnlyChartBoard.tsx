"use client";

import { ChartBoard2D } from "../../../components/phase2/ChartBoard2D.js";
import type { ChartViewModel } from "../../../phase2/types.js";

type ReadOnlyChartBoardProps = {
  viewModel: ChartViewModel;
};

export function ReadOnlyChartBoard({ viewModel }: ReadOnlyChartBoardProps) {
  return <ChartBoard2D activeLayer="main" onSelectPalace={() => undefined} selectedPalaceId="life" viewModel={viewModel} />;
}
