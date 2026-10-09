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
  const titleRef = useRef<HTMLHeadingElement>(null);
  const choices = searchCities(cities, query);
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
          搜索并选择一个城市或地区；原始地点仍保留在岗位详情中。
        </DialogDescription>
        <label>
          搜索地点
          <input
            name="city-search"
            type="search"
            autoComplete="off"
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
          {choices.map((city) => (
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
          {!choices.length && <p role="status">没有匹配的地点</p>}
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
