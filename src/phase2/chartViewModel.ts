import type { Chart, Palace } from "../types.js";
import type { ChartViewModel, PalaceViewModel, RelationKind, StarLayer } from "./types.js";

const boardPositions = [
  { x: 128, y: 40 },
  { x: 304, y: 40 },
  { x: 480, y: 40 },
  { x: 656, y: 40 },
  { x: 656, y: 216 },
  { x: 656, y: 392 },
  { x: 656, y: 568 },
  { x: 480, y: 568 },
  { x: 304, y: 568 },
  { x: 128, y: 568 },
  { x: 40, y: 392 },
  { x: 40, y: 216 }
] as const;

const tileSize = { width: 144, height: 128 };

export function buildChartViewModel(
  chart: Chart,
  options: { selectedPalaceId?: string; activeLayer?: StarLayer; activeMajorPeriodIndex?: number } = {}
): ChartViewModel {
  const activeLayer = options.activeLayer ?? "main";
  const palaces = chart.palaces.map((palace, index) => {
    const viewModel: PalaceViewModel = {
      ...palace,
      label: palace.name,
      position: {
        ...boardPositions[index],
        ...tileSize
      },
      relationKind: "inactive",
      displayStars: getDisplayStars(palace, activeLayer)
    };
    return viewModel;
  });

  const palaceById = Object.fromEntries(palaces.map((palace) => [palace.palace_id, palace]));
  const withRelations = palaces.map((palace) => ({
    ...palace,
    relationKind: getPalaceRelationKind(palace, options.selectedPalaceId)
  }));

  return {
    palaces: withRelations,
    palaceById: Object.fromEntries(withRelations.map((palace) => [palace.palace_id, palace])),
    transforms: chart.transforms,
    majorPeriods: chart.major_periods,
    activeMajorPeriod: chart.major_periods[options.activeMajorPeriodIndex ?? 0]
  };
}

export function getPalaceRelationKind(palace: PalaceViewModel, selectedPalaceId: string | undefined): RelationKind {
  if (!selectedPalaceId) return "inactive";
  if (palace.palace_id === selectedPalaceId) return "selected";
  if (palace.relation_refs.opposite === selectedPalaceId || selectedPalaceId === palace.relation_refs.opposite) return "opposite";
  if (palace.relation_refs.triad.includes(selectedPalaceId)) return "triad";
  if (palace.relation_refs.neighbors.includes(selectedPalaceId)) return "neighbor";
  return "inactive";
}

export function getDisplayStars(palace: Palace, activeLayer: StarLayer): string[] {
  if (activeLayer === "support") return palace.support_stars.slice(0, 4);
  if (activeLayer === "transforms") return palace.transforms;
  return palace.main_stars.slice(0, 3);
}
