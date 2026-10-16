import type { PreferenceProfile } from "../domain/profile";
import type { RadarState } from "./url-state";
import { resolveCityFilter, locationOptions, locationQueryNeedle } from "./location";

export const clearedFilters = {
  q: "",
  city: "",
  company: "",
  role: "",
  cat: "",
  sub: "",
  status: "all",
} as const;

export function companyOptions(
  jobs: readonly { company: string }[],
  selected = "",
) {
  return [
    ...new Set([
      ...jobs.map((job) => job.company).filter(Boolean),
      ...(selected ? [selected] : []),
    ]),
  ].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

// Preferences are copied into explicit browse state only after confirmation.
// No inferred company aliases or semantic role matching.
export function preferenceOptions(preferences: PreferenceProfile) {
  return {
    cities: locationOptions([{ location: preferences.preferred_cities }]),
    companies: [...new Set(preferences.preferred_companies)],
    roles: [...new Set(preferences.preferred_roles)],
  };
}

export function preferenceFilters(
  city: string,
  company: string,
  role: string,
): Partial<RadarState> {
  return { city: resolveCityFilter(city), company, role };
}

export function searchCities(cities: readonly string[], query: string) {
  const needle = locationQueryNeedle(query);
  return cities.filter((city) => city.toLocaleLowerCase().includes(needle));
}
