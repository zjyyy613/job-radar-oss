/** Browsing facets only. Never rewrite source/canonical location or infer a city
 * from a bare district. This conservative catalog can grow with reviewed data. */
const regions: Record<string, string[]> = {
  北京市: ["北京"], 上海市: ["上海"], 天津市: ["天津"], 重庆市: ["重庆"],
  广东省: ["深圳", "广州", "东莞"], 江苏省: ["南京", "常州", "南通", "宿迁", "扬州", "苏州", "镇江"],
  浙江省: ["杭州", "宁波"], 安徽省: ["合肥", "宿州", "淮南", "芜湖", "蚌埠"],
  山东省: ["德州", "济南", "青岛"], 山西省: ["大同", "太原"], 河北省: ["保定", "廊坊", "石家庄"],
  四川省: ["成都", "乐山"], 云南省: ["昆明"], 吉林省: ["长春"],
  内蒙古自治区: ["呼和浩特"], 广西壮族自治区: ["南宁", "柳州"],
  新疆维吾尔自治区: ["乌鲁木齐"], 江西省: ["南昌"], 河南省: ["郑州"],
  海南省: ["海口"], 湖北省: ["武汉"], 湖南省: ["长沙"], 甘肃省: ["兰州"], 陕西省: ["西安"],
  福建省: ["厦门", "泉州"], 贵州省: ["贵阳", "遵义"], 辽宁省: ["大连", "沈阳"], 黑龙江省: ["哈尔滨"],
};
const cityNames = new Set(Object.values(regions).flat());
const districts: Record<string, string[]> = {
  北京: ["顺义区", "海淀区"], 上海: ["嘉定区", "闵行区"], 深圳: ["福田区"], 常州: ["武进区"],
  青岛: ["崂山区"], 南通: ["启东市"], 苏州: ["昆山市"], 保定: ["涿州市"],
  廊坊: ["广阳区"], 石家庄: ["鹿泉区"], 郑州: ["金水区"],
};
const other: Record<string, string> = {
  香港: "香港", 香港特别行政区: "香港", 澳门: "澳门", 澳门特别行政区: "澳门",
  巴黎: "巴黎", 慕尼黑: "慕尼黑",
};
function city(token: string): string | null {
  if (Object.hasOwn(other, token)) return other[token];
  const name = token.replace(/市$/, "");
  if (cityNames.has(name)) return name;
  for (const [name, areas] of Object.entries(districts)) {
    if (areas.some(area => token === name + area || token === name + "市" + area)) return name;
  }
  return token === "深圳总部" ? "深圳" : null;
}
function segment(raw: string): string[] | null {
  const direct = city(raw);
  if (direct) return [direct];
  const parts = raw.split(/\s*[-·・]\s*/);
  const province = parts.length > 1 && Object.hasOwn(regions, parts[0]) ? parts.shift()! : null;
  const first = city(parts[0]);
  if (!first || province && !regions[province].includes(first)) return null;
  // Explicit city + verified child district is a hierarchy, not two cities.
  if (parts.slice(1).every(p => p === first || p === first + "市" || districts[first]?.includes(p))) return [first];
  const cities = parts.map(city);
  if (cities.some(c => !c || province && !regions[province].includes(c))) return null;
  return cities as string[];
}
export function normalizeLocations(locations: readonly string[]) {
  const cities = new Set<string>(), unresolved = new Set<string>();
  for (const raw of locations) {
    // Comma/slash enumerate places; hyphen/middle dot are interpreted inside a segment.
    for (const part of raw.split(/[,，、/;；|]+/).map(s => s.trim()).filter(Boolean)) {
      const found = segment(part);
      if (found) found.forEach(c => cities.add(c));
      else unresolved.add(part);
    }
  }
  return { cities: [...cities].sort(), unresolved: [...unresolved].sort() };
}
/** A legacy value is widened only when it resolves to exactly one known city. */
export function resolveCityFilter(value: string): string {
  const result = normalizeLocations([value]);
  return result.cities.length === 1 && !result.unresolved.length ? result.cities[0] : value;
}
export function matchesCity(locations: readonly string[], value: string): boolean {
  if (!value) return true;
  const selected = resolveCityFilter(value), normalized = normalizeLocations(locations);
  return normalized.cities.includes(selected) || locations.includes(value) || normalized.unresolved.includes(value);
}
export function locationOptions(jobs: readonly { location: string[] }[], selected = "") {
  const values = new Set<string>();
  for (const job of jobs) {
    const normalized = normalizeLocations(job.location);
    [...normalized.cities, ...normalized.unresolved].forEach(v => values.add(v));
  }
  // Preserve an old composite/unknown URL selection visibly instead of showing "all".
  if (selected) values.add(resolveCityFilter(selected));
  return [...values].sort();
}
