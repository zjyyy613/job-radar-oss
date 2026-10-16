import { expect, it } from "vitest";
import samples from "../fixtures/location-samples.json";
import { groupLabelMatches, locationGroups, locationOptions, matchesCity, normalizeLocations, resolveCityFilter } from "../../src/lib/radar/location";

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

it("groups cities under their existing province, with municipalities, 港澳, 境外 and 其他 last", () => {
  expect(locationGroups(["广州", "深圳", "北京", "上海", "太原", "香港", "巴黎", "浙江"])).toEqual([
    { key: "北京市", label: "北京市", kind: "municipality", options: ["北京"] },
    { key: "上海市", label: "上海市", kind: "municipality", options: ["上海"] },
    { key: "广东省", label: "广东省", kind: "province", options: ["广州", "深圳"] },
    { key: "山西省", label: "山西省", kind: "province", options: ["太原"] },
    { key: "香港", label: "香港特别行政区", kind: "region", options: ["香港"] },
    { key: "__overseas", label: "境外", kind: "overseas", options: ["巴黎"] },
    { key: "__other", label: "其他地点", kind: "other", options: ["浙江"] },
  ]);
});

it("derives every mainland group from the existing regions catalog only", () => {
  const cities = ["北京", "上海", "天津", "重庆", "广州", "南京", "杭州", "合肥", "青岛", "太原", "石家庄", "成都", "昆明", "长春", "呼和浩特", "南宁", "乌鲁木齐", "南昌", "郑州", "海口", "武汉", "长沙", "兰州", "西安", "厦门", "贵阳", "大连", "哈尔滨"];
  expect(locationGroups(cities).map(g => g.label)).toEqual([
    "北京市", "上海市", "天津市", "重庆市", "广东省", "江苏省", "浙江省", "安徽省", "山东省", "山西省",
    "河北省", "四川省", "云南省", "吉林省", "内蒙古自治区", "广西壮族自治区", "新疆维吾尔自治区",
    "江西省", "河南省", "海南省", "湖北省", "湖南省", "甘肃省", "陕西省", "福建省", "贵州省",
    "辽宁省", "黑龙江省",
  ]);
});

it("treats each special administrative region as its own group", () => {
  expect(locationGroups(["香港", "澳门", "慕尼黑"]).map(g => [g.key, g.label, g.kind])).toEqual([
    ["香港", "香港特别行政区", "region"],
    ["澳门", "澳门特别行政区", "region"],
    ["__overseas", "境外", "overseas"],
  ]);
});

it("lists only places present in the data and keeps an unmappable selection visible", () => {
  expect(locationGroups([])).toEqual([]);
  const options = locationOptions([{ location: ["广东省-深圳市"] }], "旧未知值");
  expect(options).toEqual(["旧未知值", "深圳"]);
  expect(locationGroups(options)).toEqual([
    { key: "广东省", label: "广东省", kind: "province", options: ["深圳"] },
    { key: "__other", label: "其他地点", kind: "other", options: ["旧未知值"] },
  ]);
});

it("is presentational: grouping never adds, drops or renames an option", () => {
  const values = ["北京", "广州", "香港", "巴黎", "浙江", "旧未知值"];
  expect(locationGroups(values).flatMap(g => g.options).sort()).toEqual([...values].sort());
  expect(locationGroups(values).every(g => g.options.length > 0)).toBe(true);
});

it("finds a city through its province name without that province being expanded", () => {
  expect(groupLabelMatches("广东省", "广东")).toBe(true);
  expect(groupLabelMatches("广东省", "广州")).toBe(false);
  expect(groupLabelMatches("山西省", "太原")).toBe(false);
  expect(groupLabelMatches("北京市", "北京顺义区")).toBe(true);
  expect(groupLabelMatches("广东省", "")).toBe(false);
});
