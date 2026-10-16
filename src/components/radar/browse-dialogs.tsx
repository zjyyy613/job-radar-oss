"use client";
import { useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import type { PreferenceProfile } from "@/lib/domain/profile";
import type { RadarState } from "@/lib/radar/url-state";
import {
  preferenceFilters,
  preferenceOptions,
  searchCities,
} from "@/lib/radar/browse-filters";
import { groupLabelMatches, locationGroups, shortLocationLabel } from "@/lib/radar/location";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

/** Province-grouped picker: a multi-column province index with the chosen
 * province's cities beside it. Selecting a province only changes what is listed —
 * the filter value is always a concrete city or the original raw location. */
export function CityChoice({
  cities,
  value,
  onChange,
}: {
  cities: string[];
  value: string;
  onChange: (city: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const citiesTitleRef = useRef<HTMLParagraphElement>(null);
  const provincesRef = useRef<HTMLDivElement>(null);
  const searching = Boolean(query.trim());
  const groups = locationGroups(cities);
  const nameMatched = new Set(searchCities(cities, query));
  const matches = groups
    .map((group) => ({
      ...group,
      // A province query reveals its cities, and search never depends on the index.
      options: !searching
        ? group.options
        : groupLabelMatches(group.label, query)
          ? group.options
          : group.options.filter((option) => nameMatched.has(option)),
    }))
    .filter((group) => group.options.length);
  const hint = (group: (typeof groups)[number], option: string) =>
    group.unresolved?.includes(option) ? "未注明城市" : undefined;
  // Locations that need no province step stay one click away on both surfaces.
  const quick = groups
    .filter((group) => group.kind !== "province")
    .flatMap((group) => group.options.map((option) => ({ option, hint: hint(group, option) })));
  const activeGroup = groups.find((group) => group.key === active) ?? null;
  function choose(city: string) {
    onChange(city);
    setOpen(false);
  }
  function openProvince(key: string) {
    setActive(key);
    // The city pane content is what changed, so focus follows it (both surfaces).
    requestAnimationFrame(() => citiesTitleRef.current?.focus());
  }
  function backToIndex() {
    setActive(null);
    requestAnimationFrame(() => provincesRef.current?.focus());
  }
  // Full-width rows spell out the state; compact chips use a mark so a long city
  // name never wraps, and aria-pressed still carries the meaning.
  const selected = (compact: boolean) =>
    compact ? <Check size={13} aria-hidden="true" /> : <span>已选择</span>;
  const option = (group: (typeof groups)[number], city: string) => (
    <button
      key={city}
      type="button"
      aria-pressed={city === value}
      onClick={() => choose(city)}
    >
      {city}
      {hint(group, city) && <span className="city-hint">{hint(group, city)}</span>}
      {city === value && selected(false)}
    </button>
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery("");
        // Reopen where the current selection lives, so it is visible immediately.
        setActive(next ? groups.find((group) => group.kind === "province" && group.options.includes(value))?.key ?? null : null);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="city-trigger"
          aria-label={`地点：${value || "全部地点"}`}
        >
          {value || "全部地点"}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="browse-dialog city-dialog"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogTitle ref={titleRef} tabIndex={-1}>选择地点</DialogTitle>
        <DialogDescription>
          按省份或地区浏览，也可直接搜索。分组仅用于查找，点击具体地点后才会筛选岗位；原始地点仍保留在岗位详情中。
        </DialogDescription>
        <label>
          搜索地点
          <input
            name="city-search"
            type="search"
            autoComplete="off"
            placeholder="搜索城市或省份，例如 太原 / 广东"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {searching ? (
          <div className="city-options">
            <button type="button" aria-pressed={!value} onClick={() => choose("")}>
              全部地点{!value && <span>已选择</span>}
            </button>
            {matches.map((group) => (
              <section className="city-group" key={group.key}>
                <p className="city-group-label">{group.label}</p>
                <div className="city-group-options" role="group" aria-label={group.label}>
                  {group.options.map((city) => option(group, city))}
                </div>
              </section>
            ))}
            {!matches.length && <p role="status">没有匹配的地点</p>}
          </div>
        ) : (
          <div className="city-picker" data-step={active ? "cities" : "index"}>
            <div className="city-index">
              <button type="button" className="city-all" aria-pressed={!value} onClick={() => choose("")}>
                全部地点{!value && <span>已选择</span>}
              </button>
              {quick.length > 0 && (
                <>
                  <p className="city-pane-title">直辖市与地区</p>
                  <div className="city-quick" role="group" aria-label="直辖市与地区">
                    {quick.map(({ option: city, hint: cityHint }) => (
                      <button key={city} type="button" aria-pressed={city === value} onClick={() => choose(city)}>
                        {city}
                        {cityHint && <span className="city-hint">{cityHint}</span>}
                        {city === value && selected(true)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="city-pane-title">省份</p>
              <div className="city-provinces" role="group" aria-label="省份" ref={provincesRef} tabIndex={-1}>
                {groups.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    className="city-province"
                    aria-current={group.key === active}
                    title={group.label}
                    onClick={() => openProvince(group.key)}
                  >
                    {shortLocationLabel(group.label)}
                  </button>
                ))}
              </div>
            </div>
            <div className="city-cities" role="group" aria-label={activeGroup?.label ?? "选择省份"}>
              <button type="button" className="city-back" onClick={backToIndex}>
                ← 返回省份
              </button>
              <p className="city-pane-title" ref={citiesTitleRef} tabIndex={-1}>
                {activeGroup ? activeGroup.label : "选择省份查看城市"}
              </p>
              {activeGroup ? (
                <div className="city-pane-options">{activeGroup.options.map((city) => option(activeGroup, city))}</div>
              ) : (
                <p className="city-pane-empty">从省份中选择，或使用上方的直辖市与地区。</p>
              )}
            </div>
          </div>
        )}
        <DialogClose asChild>
          <Button variant="outline">取消</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

export function PreferenceChoice({
  preferences,
  onChange,
}: {
  preferences: PreferenceProfile;
  onChange: (value: Partial<RadarState>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const options = preferenceOptions(preferences);
  if (
    !options.cities.length &&
    !options.companies.length &&
    !options.roles.length
  )
    return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setCity("");
        setCompany("");
        setRole("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost">应用求职偏好</Button>
      </DialogTrigger>
      <DialogContent className="browse-dialog" showCloseButton={false}>
        <DialogTitle>应用求职偏好</DialogTitle>
        <DialogDescription>
          从已保存偏好中选择本次浏览条件，每项最多一个。替换当前地点、公司和岗位关键词，保留搜索及资格筛选。偏好不参与资格判断。
        </DialogDescription>
        <form
          className="preference-form"
          onSubmit={(e) => {
            e.preventDefault();
            onChange(preferenceFilters(city, company, role));
            setOpen(false);
          }}
        >
          <label>
            偏好地点
            <select
              name="preferred-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">不限地点</option>
              {options.cities.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            偏好公司
            <select
              name="preferred-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              <option value="">不限公司</option>
              {options.companies.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            岗位关键词
            <select
              name="preferred-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">不限岗位</option>
              {options.roles.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <p className="muted">
            岗位仅按标题包含关键词筛选，不代表精准匹配；公司按现有名称精确匹配，未知公司可能无结果。
          </p>
          <div className="browse-dialog-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                取消
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!city && !company && !role}>
              应用到浏览
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
