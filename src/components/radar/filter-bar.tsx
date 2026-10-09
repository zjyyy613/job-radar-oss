"use client";
import { useState, useSyncExternalStore } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import type { RadarState } from "@/lib/radar/url-state";
import { CityChoice, PreferenceChoice } from "./browse-dialogs";
import type { PreferenceProfile } from "@/lib/domain/profile";
import { clearedFilters } from "@/lib/radar/browse-filters";
import { Button } from "@/components/ui/button";
function subscribeWide(listener: () => void) {
  const m = window.matchMedia("(min-width:768px)");
  m.addEventListener("change", listener);
  return () => m.removeEventListener("change", listener);
}
export function FilterBar({
  state,
  cities,
  companies,
  preferences,
  onChange,
}: {
  state: RadarState;
  cities: string[];
  companies: string[];
  preferences: PreferenceProfile;
  onChange: (value: Partial<RadarState>) => void;
}) {
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia("(min-width:768px)").matches,
    () => false,
  );
  const [expanded, setExpanded] = useState(false);
  const active = Boolean(
    state.q ||
    state.city ||
    state.company ||
    state.role ||
    state.status !== "all",
  );
  return (
    <div className="filter-bar">
      <label className="search-field">
        <span className="sr-only">搜索岗位或公司</span>
        <Search size={16} aria-hidden="true" />
        <input
          name="q"
          type="search"
          autoComplete="off"
          placeholder="搜索岗位、公司或地点…"
          value={state.q}
          onChange={(e) => onChange({ q: e.target.value })}
        />
      </label>
      <details className="filter-controls" open={wide || expanded}>
        <summary
          onClick={(e) => {
            e.preventDefault();
            setExpanded(!expanded);
          }}
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          <span>筛选与排序{active ? " · 已筛选" : ""}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="filter-selects">
          <div className="filter-city">
            <span>地点</span>
            <CityChoice
              cities={cities}
              value={state.city}
              onChange={(city) => onChange({ city })}
            />
          </div>
          <label>
            公司
            <select
              name="company"
              value={state.company}
              onChange={(e) => onChange({ company: e.target.value })}
            >
              <option value="">全部公司</option>
              {companies.map((company) => (
                <option key={company}>{company}</option>
              ))}
            </select>
          </label>
          <label>
            资格
            <select
              name="status"
              value={state.status}
              onChange={(e) =>
                onChange({ status: e.target.value as RadarState["status"] })
              }
            >
              <option value="all">全部资格</option>
              <option value="Eligible">无明显冲突</option>
              <option value="Check">需要确认</option>
              <option value="Blocked">存在不符合项</option>
              <option value="Excluded">已关闭</option>
            </select>
          </label>
          <label>
            排序
            <select
              name="sort"
              value={state.sort}
              onChange={(e) =>
                onChange({ sort: e.target.value as RadarState["sort"] })
              }
            >
              <option value="qualification">资格优先</option>
              <option value="freshness">最近收录</option>
            </select>
          </label>
        </div>
      </details>
      <div className="browse-actions">
        <PreferenceChoice preferences={preferences} onChange={onChange} />
        {state.role && (
          <span>
            标题包含：{state.role}{" "}
            <Button
              variant="ghost"
              aria-label="取消岗位关键词筛选"
              onClick={() => onChange({ role: "" })}
            >
              取消
            </Button>
          </span>
        )}
        {active && (
          <Button variant="ghost" onClick={() => onChange(clearedFilters)}>
            清除全部筛选
          </Button>
        )}
      </div>
    </div>
  );
}
