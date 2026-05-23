import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "data/phase0/sample-charts-v0.1.csv");
const outputPath = resolve(root, "data/phase1/test-charts-v0.1.csv");

type Row = Record<string, string>;

const source = readFileSync(sourcePath, "utf8").trim();
const [headerLine, ...bodyLines] = source.split(/\r?\n/);
const headers = headerLine.split(",");
const rows = bodyLines.map(parseRow);

const scenarioTypes = [
  "ordinary_gregorian",
  "lunar_input",
  "zi_hour_boundary",
  "timezone_case",
  "true_solar_time_probe",
  "gender_rule_case"
] as const;

const cities = [
  ["北京", "116.4074", "39.9042", "Asia/Shanghai"],
  ["上海", "121.4737", "31.2304", "Asia/Shanghai"],
  ["广州", "113.2644", "23.1291", "Asia/Shanghai"],
  ["成都", "104.0665", "30.5728", "Asia/Shanghai"],
  ["台北", "121.5654", "25.0330", "Asia/Taipei"],
  ["东京", "139.6917", "35.6895", "Asia/Tokyo"],
  ["伦敦", "-0.1276", "51.5072", "Europe/London"],
  ["洛杉矶", "-118.2437", "34.0522", "America/Los_Angeles"]
];

while (rows.length < 100) {
  const index = rows.length + 1;
  const scenario = scenarioTypes[index % scenarioTypes.length];
  const city = cities[index % cities.length];
  const isLunar = scenario === "lunar_input";
  const time = scenario === "zi_hour_boundary" ? ["22:59", "23:00", "23:59", "00:00", "00:59", "01:00"][index % 6] : `${String((index * 3) % 24).padStart(2, "0")}:${String((index * 7) % 60).padStart(2, "0")}`;
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String((index % 27) + 1).padStart(2, "0");
  const year = String(1970 + (index % 45));
  const gender = scenario === "gender_rule_case" ? (index % 2 === 0 ? "traditional_male" : "traditional_female") : "traditional_unspecified";

  rows.push({
    case_id: `ZWMVP-${String(index).padStart(3, "0")}`,
    scenario_type: scenario,
    calendar_type: isLunar ? "lunar" : "gregorian",
    birth_date: `${year}-${month}-${day}`,
    birth_time: time,
    timezone: city[3],
    location_name: city[0],
    longitude: city[1],
    latitude: city[2],
    gender_rule: gender,
    is_leap_month: isLunar && index % 3 === 0 ? "true" : "false",
    true_solar_time_enabled: scenario === "true_solar_time_probe" ? "true" : "false",
    zi_hour_day_boundary: "civil_midnight",
    leap_month_policy: "same_month_number",
    expected_palaces: "PENDING_CONSULTANT",
    expected_major_stars: "PENDING_CONSULTANT",
    expected_transforms: "PENDING_CONSULTANT",
    expected_major_periods: "PENDING_CONSULTANT",
    consultant_notes: `阶段1扩展样例-${scenario}`,
    validation_status: "seed_needs_consultant"
  });
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, [headerLine, ...rows.slice(0, 100).map(formatRow)].join("\n") + "\n", "utf8");
console.log(`Generated ${outputPath} with 100 rows.`);

function parseRow(line: string): Row {
  const values = line.split(",");
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
}

function formatRow(row: Row): string {
  return headers.map((header) => row[header] ?? "").join(",");
}
