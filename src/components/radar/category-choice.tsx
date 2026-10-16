"use client";
import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_L1,
  categoryLabel,
  childrenOf,
  level1Label,
  type CategoryCounts,
} from "@/lib/radar/job-category";

/**
 * Two-level job-category navigation.
 *
 * - Picking a level-1 direction filters immediately, so the whole direction is
 *   reachable in one click without being forced through a level-2 choice.
 * - The level-2 pane then narrows further, and its first row returns to the whole
 *   direction.
 * - Counts come from `counts`, which the caller derives from the jobs that match
 *   every OTHER active filter, so a number never contradicts the resulting list.
 * - `available` only decides which categories exist, so a category with real jobs
 *   never disappears from the menu just because the current filters exclude it.
 */
export function CategoryChoice({
  available,
  counts,
  cat,
  sub,
  onChange,
}: {
  available: CategoryCounts;
  counts: CategoryCounts;
  cat: string;
  sub: string;
  onChange: (value: { cat: string; sub: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(cat);
  // Narrow layouts show one step at a time. Tracked separately from `active`,
  // because returning to the index must stay possible while a category is applied.
  const [showIndex, setShowIndex] = useState(!cat);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const paneTitleRef = useRef<HTMLParagraphElement>(null);
  const indexRef = useRef<HTMLDivElement>(null);

  const level1 = CATEGORY_L1.filter((c) => (available.byL1[c.id] ?? 0) > 0);
  const activeId = active || cat;
  const level2 = activeId ? childrenOf(activeId).filter((c) => (available.byL2[c.id] ?? 0) > 0) : [];
  const activeLabel = level1Label(activeId);
  const triggerLabel = sub
    ? `${level1Label(cat)} · ${categoryLabel(sub)}`
    : cat
      ? level1Label(cat)
      : "全部类别";

  function openLevel1(id: string) {
    // A level-1 is a valid filter on its own, so it applies immediately; the
    // dialog stays open so the level-2 options and their counts remain visible.
    setActive(id);
    setShowIndex(false);
    onChange({ cat: id, sub: "" });
    requestAnimationFrame(() => paneTitleRef.current?.focus());
  }

  function choose(catId: string, subId: string) {
    // A final choice closes the dialog, so the filtered list is immediately
    // visible instead of hidden behind the modal.
    onChange({ cat: catId, sub: subId });
    setOpen(false);
  }

  function backToIndex() {
    setShowIndex(true);
    requestAnimationFrame(() => indexRef.current?.focus());
  }

  function countLabel(value: number) {
    return <span className="category-count">{value}</span>;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setActive(cat);
          setShowIndex(!cat);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="category-trigger"
          aria-label={`岗位类别：${triggerLabel}`}
        >
          {triggerLabel}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="browse-dialog city-dialog category-dialog"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogTitle ref={titleRef} tabIndex={-1}>
          选择岗位类别
        </DialogTitle>
        <DialogDescription>
          按职能方向浏览。选择一级即可查看该方向全部岗位，二级可继续缩小范围；类别由岗位标题确定性归类，标注待核实的岗位仅作暂定分类。
        </DialogDescription>

        <div
          className="city-picker category-picker"
          data-step={showIndex ? "index" : "cities"}
        >
          <div className="city-index category-index">
            <button
              type="button"
              className="city-all category-all"
              aria-pressed={!cat}
              onClick={() => choose("", "")}
            >
              全部类别
              {!cat && <span>已选择</span>}
            </button>
            <p className="city-pane-title category-pane-title">职业方向</p>
            <div
              className="city-provinces category-level1"
              role="group"
              aria-label="职业方向"
              ref={indexRef}
              tabIndex={-1}
            >
              {level1.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="city-province category-level1-item"
                  aria-current={item.id === activeId}
                  aria-pressed={item.id === cat && !sub}
                  data-empty={(counts.byL1[item.id] ?? 0) === 0 ? "true" : undefined}
                  title={`${item.label} · ${available.byL1[item.id] ?? 0} 个岗位`}
                  onClick={() => openLevel1(item.id)}
                >
                  {item.label}
                  {countLabel(counts.byL1[item.id] ?? 0)}
                </button>
              ))}
            </div>
          </div>

          <div className="city-cities category-level2">
            <button type="button" className="city-back category-back" onClick={backToIndex}>
              ← 返回职业方向
            </button>
            <p className="city-pane-title category-pane-title" tabIndex={-1} ref={paneTitleRef}>
              {activeLabel}
            </p>
            <div className="city-pane-options category-options" role="group" aria-label="岗位小类">
              {!activeId && (
                <p className="city-pane-empty category-pane-empty">
                  从左侧选择职业方向，即可看到该方向的小类与数量。
                </p>
              )}
              {activeId && (
                <button
                  type="button"
                  className="category-all-level1"
                  aria-pressed={activeId === cat && !sub}
                  onClick={() => choose(activeId, "")}
                >
                  全部{activeLabel}
                  {countLabel(counts.byL1[activeId] ?? 0)}
                  {activeId === cat && !sub && <span>已选择</span>}
                </button>
              )}
              {level2.map((item) => {
                const tentative = counts.tentativeByL2[item.id] ?? 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === sub}
                    data-empty={(counts.byL2[item.id] ?? 0) === 0 ? "true" : undefined}
                    onClick={() => choose(activeId, item.id)}
                  >
                    {item.label}
                    {countLabel(counts.byL2[item.id] ?? 0)}
                    {tentative > 0 && (
                      <span className="city-hint category-hint">{tentative} 条类别待核实</span>
                    )}
                    {item.id === sub && <Check size={13} aria-hidden="true" />}
                  </button>
                );
              })}
              {activeId && level2.length === 0 && (
                <p className="city-pane-empty category-pane-empty">
                  该方向暂无可浏览的小类。
                </p>
              )}
            </div>
          </div>
        </div>
        <DialogClose asChild>
          <Button variant="outline">取消</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
