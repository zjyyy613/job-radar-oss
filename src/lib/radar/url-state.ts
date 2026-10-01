import {
  createLoader,
  createSerializer,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
export const radarParsers = {
  q: parseAsString.withDefault(""),
  city: parseAsString.withDefault(""),
  status: parseAsStringLiteral([
    "all",
    "Eligible",
    "Check",
    "Blocked",
    "Excluded",
  ] as const).withDefault("all"),
  sort: parseAsStringLiteral([
    "qualification",
    "freshness",
  ] as const).withDefault("qualification"),
  job: parseAsString.withDefault(""),
};
export const loadRadarState = createLoader(radarParsers);
export const radarUrl = createSerializer(radarParsers);
export type RadarState = Awaited<ReturnType<typeof loadRadarState>>;
export function fullDetailUrl(id: string, state: RadarState) {
  return `/jobs/${encodeURIComponent(id)}?returnTo=${encodeURIComponent(radarUrl("/radar", state))}`;
}
export function safeRadarReturn(value: string | undefined) {
  if (!value) return "/radar";
  try {
    const url = new URL(value, "https://radar.local");
    return url.origin === "https://radar.local" && url.pathname === "/radar"
      ? url.pathname + url.search
      : "/radar";
  } catch {
    return "/radar";
  }
}
