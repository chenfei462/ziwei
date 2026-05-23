const palaceBackgroundsByLabel = {
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
} as const satisfies Record<string, string>;

type PalaceBackgroundLabel = keyof typeof palaceBackgroundsByLabel;

export function getPalaceBackgroundHref(label: string): string | undefined {
  return isPalaceBackgroundLabel(label) ? palaceBackgroundsByLabel[label] : undefined;
}

function isPalaceBackgroundLabel(label: string): label is PalaceBackgroundLabel {
  return label in palaceBackgroundsByLabel;
}
