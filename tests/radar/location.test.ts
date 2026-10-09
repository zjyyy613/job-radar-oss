import { expect, it } from "vitest";
import samples from "../fixtures/location-samples.json";
import { locationOptions, matchesCity, normalizeLocations, resolveCityFilter } from "../../src/lib/radar/location";

it.each([
  ["北京", ["北京"]], ["北京市", ["北京"]], ["北京顺义区", ["北京"]],
  ["上海", ["上海"]], ["上海市", ["上海"]], ["上海嘉定区", ["上海"]],
  ["北京市-北京市", ["北京"]], ["广东省-深圳市", ["深圳"]],
  ["广东省·深圳市", ["深圳"]], ["北京市,上海市", ["上海", "北京"]],
  ["北京，上海、深圳", ["上海", "北京", "深圳"]],
  ["上海市,深圳市,成都市", ["上海", "成都", "深圳"]],
  ["北京-上海", ["上海", "北京"]], ["北京·上海", ["上海", "北京"]],
  ["江苏省-苏州市-昆山市", ["苏州"]], ["江苏省-南通市-启东市", ["南通"]],
  ["香港特别行政区", ["香港"]], ["澳门特别行政区", ["澳门"]],
  ["巴黎", ["巴黎"]], ["慕尼黑", ["慕尼黑"]],
] as [string, string[]][])("normalizes %s without changing raw location", (raw, expected) => {
  const input = Object.freeze([raw]);
  expect(normalizeLocations(input)).toEqual({ cities: expected, unresolved: [] });
  expect(input).toEqual([raw]);
});

it.each(["未知地名", "浙江", "海南省-澄迈县", "朝阳区", "昆山市", "北京路", "上海镇", "美国-北京市", "广东省-北京市", "Paris", "Saint-Louis"])("does not guess %s", raw => {
  expect(normalizeLocations([raw])).toEqual({ cities: [], unresolved: [raw] });
  expect(matchesCity([raw], "北京")).toBe(false);
});

it("deduplicates multi-city membership and handles empty locations", () => {
  expect(normalizeLocations(["北京", "北京市", "北京市,上海市"])).toEqual({ cities: ["上海", "北京"], unresolved: [] });
  expect(normalizeLocations([])).toEqual({ cities: [], unresolved: [] });
  expect(locationOptions([{ location: ["北京", "北京市"] }])).toEqual(["北京"]);
});

it("keeps legacy links safe and visible without widening ambiguous composites", () => {
  expect(resolveCityFilter("北京顺义区")).toBe("北京");
  expect(matchesCity(["北京市,上海市"], "北京市")).toBe(true);
  expect(matchesCity(["上海"], "北京市,上海市")).toBe(false);
  expect(matchesCity(["北京市,上海市"], "北京市,上海市")).toBe(true);
  expect(locationOptions([{ location: ["上海"] }], "旧未知值")).toContain("旧未知值");
});

it("classifies the real corpus conservatively; remaining province/county values stay raw", () => {
  expect(samples).toHaveLength(96);
  expect(samples.filter(s => normalizeLocations([s]).unresolved.length)).toEqual(["浙江", "海南省-澄迈县"]);
  expect(matchesCity(["香港", "巴黎"], "深圳")).toBe(false);
});
