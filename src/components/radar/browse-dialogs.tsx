"use client";
import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PreferenceProfile } from "@/lib/domain/profile";
import type { RadarState } from "@/lib/radar/url-state";
import {
  preferenceFilters,
  preferenceOptions,
  searchCities,
} from "@/lib/radar/browse-filters";
import { groupLabelMatches, locationGroups } from "@/lib/radar/location";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

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
  // Only user overrides are stored; every other group keeps its computed default.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const titleRef = useRef<HTMLHeadingElement>(null);
  const searching = Boolean(query.trim());
  const nameMatched = new Set(searchCities(cities, query));
  const groups = locationGroups(cities)
    .map((group) => ({
      ...group,
      // A province query reveals its cities, and search never depends on expansion.
      options: !searching
        ? group.options
        : groupLabelMatches(group.label, query)
          ? group.options
          : group.options.filter((option) => nameMatched.has(option)),
    }))
    .filter((group) => group.options.length);
  // Municipalities, 港澳/境外/其他 and the current selection start open; mainland
  // provinces start collapsed so the list stays scannable.
  const expanded = (group: (typeof groups)[number]) =>
    searching || (overrides[group.key] ?? (group.kind !== "province" || group.options.includes(value)));
  function choose(city: string) {
    onChange(city);
    setOpen(false);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery("");
        setOverrides({});
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
        className="browse-dialog"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogTitle ref={titleRef} tabIndex={-1}>选择地点</DialogTitle>
        <DialogDescription>
          按省份分组查找；展开省份只用于浏览，最终选择的是具体城市。原始地点仍保留在岗位详情中。
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
        <div className="city-options">
          <button
            type="button"
            aria-pressed={!value}
            onClick={() => choose("")}
          >
            全部地点{!value && <span>已选择</span>}
          </button>
          {groups.map((group) => {
            const isOpen = expanded(group);
            const panelId = `city-group-${group.key}`;
            return (
              <section className="city-group" key={group.key}>
                {searching ? (
                  <p className="city-group-label">{group.label}</p>
                ) : (
                  <button
                    type="button"
                    className="city-group-toggle"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() =>
                      setOverrides((current) => ({ ...current, [group.key]: !isOpen }))
                    }
                  >
                    <span>{group.label}</span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                )}
                <div
                  className="city-group-options"
                  id={panelId}
                  role="group"
                  aria-label={group.label}
                  hidden={!isOpen}
                >
                  {group.options.map((city) => (
                    <button
                      key={city}
                      type="button"
                      aria-pressed={city === value}
                      onClick={() => choose(city)}
                    >
                      {city}
                      {city === value && <span>已选择</span>}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
          {!groups.length && <p role="status">没有匹配的地点</p>}
        </div>
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
