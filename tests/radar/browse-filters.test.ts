import { describe, expect, it } from "vitest";
import {
  clearedFilters,
  companyOptions,
  preferenceOptions,
  preferenceFilters,
  searchCities,
} from "../../src/lib/radar/browse-filters";
import { loadRadarState } from "../../src/lib/radar/url-state";
import { emptyGuestProfile } from "../../src/lib/profile/local-profile";

describe("browse-only preference helpers", () => {
  it("deduplicates exact real names without inferring a parent company; keeps unknown URL selection visible", () => {
    expect(
      companyOptions(
        [{ company: "腾讯" }, { company: "腾讯" }, { company: "腾讯文档" }],
        "未知公司",
      ),
    ).toEqual(expect.arrayContaining(["腾讯", "腾讯文档", "未知公司"]));
    expect(companyOptions([{ company: "腾讯" }, { company: "腾讯" }])).toEqual([
      "腾讯",
    ]);
    expect(companyOptions([])).toEqual([]);
  });
  it("normalizes saved cities into single choices and preserves unknown names without guessing", () => {
    const preferences = {
      preferred_cities: ["北京市", "北京顺义区", "上海市,深圳市", "朝阳区"],
      preferred_roles: ["产品", "产品"],
      preferred_companies: ["未知", "腾讯"],
    };
    const before = JSON.stringify(preferences);
    const options = preferenceOptions(preferences);
    expect(options.cities).toHaveLength(4);
    expect(options.cities).toEqual(
      expect.arrayContaining(["北京", "上海", "深圳", "朝阳区"]),
    );
    expect(options.roles).toEqual(["产品"]);
    expect(options.companies).toEqual(["未知", "腾讯"]);
    expect(JSON.stringify(preferences)).toBe(before);
    expect(preferenceFilters("北京市", "未知", "产品")).toEqual({
      city: "北京",
      company: "未知",
      role: "产品",
    });
  });
  it("no preferences means no automatic browse conditions", () => {
    expect(preferenceOptions(emptyGuestProfile().preferences)).toEqual({
      cities: [],
      companies: [],
      roles: [],
    });
    expect(preferenceFilters("", "", "")).toEqual({
      city: "",
      company: "",
      role: "",
    });
  });
  it("clear resets every filter while preserving sort and selected detail", () => {
    const state = loadRadarState({
      q: "x",
      city: "北京",
      company: "腾讯",
      role: "产品",
      status: "Blocked",
      sort: "freshness",
      job: "1",
    });
    expect({ ...state, ...clearedFilters }).toEqual(
      loadRadarState({ sort: "freshness", job: "1" }),
    );
  });
  it("city search supports existing aliases, unknown values and empty results", () => {
    const cities = ["北京", "上海", "巴黎", "浙江"];
    expect(searchCities(cities, "北京市")).toEqual(["北京"]);
    expect(searchCities(cities, "巴")).toEqual(["巴黎"]);
    expect(searchCities(cities, "不存在")).toEqual([]);
    expect(searchCities(cities, "")).toEqual(cities);
  });
});
