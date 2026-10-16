"""Job-category navigation acceptance (PRODUCT-03B).

Drives the real `RadarClient` against the real 472-title snapshot through the
temporary harness route, because this worktree has no server credentials for
`/radar`. This is a COMPONENT-level acceptance, not a real-page end-to-end one.

Honest scope of the harness: jobs/companies/titles are real; ids come from
snapshot_row; locations are assigned per company; gates are empty.

Usage:
    CITY_BASE_URL=http://127.0.0.1:3333/radarcheck-tmp python tests/browser/job-category.py

Environment:
    CITY_BASE_URL  page under test (default /radarcheck-tmp on port 3333)
    CITY_OUT       artifact directory for screenshots + results JSON
    CITY_CHROME    explicit Chromium executable when the cached build differs
                   from the installed Playwright version
"""
import json
import os
import pathlib
import re
import sys
from urllib.parse import unquote

from playwright.sync_api import sync_playwright

BASE = os.environ.get("CITY_BASE_URL", "http://127.0.0.1:3333/radarcheck-tmp")
OUT = pathlib.Path(os.environ.get("CITY_OUT", "docs/reports/assets/job-category-v1"))
CHROME = os.environ.get("CITY_CHROME") or None
TOTAL = int(os.environ.get("CITY_TOTAL", "472"))

results: list[dict[str, object]] = []
observations: list[dict[str, object]] = []


def check(surface: str, name: str, ok: bool, detail: object = None) -> None:
    results.append({"surface": surface, "check": name, "pass": bool(ok), "detail": detail})
    if not ok:
        raise AssertionError(f"[{surface}] {name}: {detail}")


def observe(surface: str, name: str, detail: object = None) -> None:
    observations.append({"surface": surface, "observation": name, "detail": detail})


def visible(locator) -> bool:
    try:
        return locator.is_visible()
    except Exception:  # noqa: BLE001
        return False


def shown_count(page) -> int:
    text = page.locator(".result-line span").first.inner_text()
    found = re.search(r"(\d+)", text)
    return int(found.group(1)) if found else -1


def param(page, name: str) -> str:
    match = re.search(rf"[?&]{name}=([^&]*)", page.url)
    return unquote(match.group(1)) if match else ""


def wait_for_category(page, cat: str, sub: str = "", timeout: int = 8000) -> None:
    """nuqs writes the URL inside a React transition, so the address bar can lag
    the click. Wait for the parameters instead of reading a stale URL."""
    page.wait_for_function(
        """([c, s]) => {
             const p = new URLSearchParams(location.search);
             return (p.get('cat') || '') === c && (p.get('sub') || '') === s;
           }""",
        arg=[cat, sub],
        timeout=timeout,
    )


def ensure_controls(page) -> None:
    if not visible(page.locator(".category-trigger")):
        page.locator(".filter-controls > summary").first.click()
        page.wait_for_timeout(200)


def open_picker(page) -> None:
    if visible(page.locator(".category-dialog")):
        return
    ensure_controls(page)
    page.locator(".category-trigger").click()
    page.locator(".category-dialog").wait_for(state="visible")


def index_step(page, narrow: bool) -> None:
    if narrow and not visible(page.locator(".category-index")):
        page.locator(".category-back").click()


def open_level1(page, label: str, narrow: bool) -> None:
    """Browse a direction's level-2 options. This must NOT apply any filter; the
    level-1 is only applied by the 全部该方向岗位 row or a level-2 choice."""
    open_picker(page)
    index_step(page, narrow)
    page.locator(".category-level1-item", has_text=label).first.click()
    # Sync point: the level-2 pane must reflect the chosen direction before any
    # item inside it is clicked.
    page.locator(".category-level2 .category-pane-title", has_text=label).first.wait_for(state="visible")


def count_in(locator) -> int:
    """Read the item's own count element, never a number from nearby hint text."""
    text = locator.locator(".category-count").first.inner_text()
    found = re.search(r"\d+", text)
    return int(found.group(0)) if found else -1


def item_count(page, label: str) -> int:
    return count_in(page.locator(".category-level1-item", has_text=label).first)


def run(surface: str, width: int, height: int) -> None:
    narrow = width < 768
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME) if CHROME else p.chromium.launch()
        page = browser.new_page(viewport={"width": width, "height": height})
        page.goto(BASE, wait_until="networkidle")
        page.locator(".result-line").wait_for(state="visible")
        baseline = shown_count(page)
        check(surface, "default list shows every job", baseline == TOTAL, {"shown": baseline, "expected": TOTAL})
        page.screenshot(path=str(OUT / f"{surface}-01-default.png"))

        # --- A. picker structure ---------------------------------------------
        open_picker(page)
        focused = page.evaluate("document.activeElement && document.activeElement.tagName")
        check(surface, "opening the picker focuses its title", focused == "H2", focused)
        level1 = page.locator(".category-level1-item")
        check(surface, "level-1 index populated", level1.count() >= 10, level1.count())
        labels = [t.strip().split("\n")[0] for t in level1.all_inner_texts()]
        for expected in ("技术研发", "产品", "工程与制造", "运营", "其他"):
            check(surface, f"{expected} present", any(l.startswith(expected) for l in labels), labels)
        check(surface, "no zero-job level-1 category is listed", level1.count() <= 11, level1.count())
        cancel = page.get_by_role("button", name="取消").bounding_box()
        check(surface, "cancel reachable without scrolling", cancel and cancel["y"] + cancel["height"] <= height + 1, cancel)
        check(surface, "no horizontal overflow", page.evaluate("document.scrollingElement.scrollWidth - window.innerWidth") <= 1)
        if narrow:
            check(surface, "narrow: one step at a time",
                  visible(page.locator(".category-index")) and not visible(page.locator(".category-level2")))
        else:
            check(surface, "wide: index and level-2 pane together",
                  visible(page.locator(".category-index")) and visible(page.locator(".category-level2")))
            columns = page.evaluate("getComputedStyle(document.querySelector('.category-level1')).gridTemplateColumns.split(' ').length")
            check(surface, "wide: multi-column index", columns >= 3, columns)
        page.screenshot(path=str(OUT / f"{surface}-02-picker.png"))

        # --- B. required paths, and counts that match the resulting list ------
        paths = [
            ("技术研发", "算法与AI", "tech", "tech.algo"),
            ("产品", "产品经理", "product", "product.pm"),
            ("工程与制造", "机械与结构", "engineering", "engineering.mech"),
            ("运营", "产品与用户运营", "ops", "ops.product_user"),
        ]
        for i, (l1, l2, l1id, l2id) in enumerate(paths):
            open_picker(page)
            index_step(page, narrow)
            advertised_l1 = item_count(page, l1)
            check(surface, f"{l1}: index advertises a real count", advertised_l1 > 0, advertised_l1)
            open_level1(page, l1, narrow)
            pane = page.locator(".category-options")
            check(surface, f"{l1}: level-2 pane lists {l2}", visible(pane.get_by_role("button", name=re.compile(l2))))
            advertised_l2 = count_in(pane.get_by_role("button", name=re.compile(l2)).first)
            check(surface, f"{l2}: number is not hidden for being small", advertised_l2 >= 0, advertised_l2)
            if i == 0 and not narrow:
                page.screenshot(path=str(OUT / f"{surface}-03-{l1id}.png"))
            pane.get_by_role("button", name=re.compile(l2)).first.click()
            # A final choice closes the dialog so the filtered list is visible.
            page.locator(".category-dialog").wait_for(state="hidden")
            wait_for_category(page, l1id, l2id)
            check(surface, f"{l2}: writes stable ids to the URL", (param(page, "cat"), param(page, "sub")) == (l1id, l2id),
                  {"url": page.url})
            after = shown_count(page)
            check(surface, f"{l2}: shown count equals the advertised number", after == advertised_l2,
                  {"shown": after, "advertised": advertised_l2})
            observe(surface, f"{l2} count", after)
            if i == 0:
                page.screenshot(path=str(OUT / f"{surface}-04-{l2id}-filtered.png"))
            # level-1 alone must still be reachable without a level-2 choice
            open_picker(page)
            index_step(page, narrow)
            before_cat, before_sub = param(page, "cat"), param(page, "sub")
            before_count = shown_count(page)
            open_level1(page, l1, narrow)
            # Browsing the direction must not have applied anything yet.
            check(surface, f"{l1}: browsing the direction keeps the previous filter",
                  (param(page, "cat"), param(page, "sub")) == (before_cat, before_sub), page.url)
            check(surface, f"{l1}: browsing the direction keeps the previous list",
                  shown_count(page) == before_count, {"before": before_count, "after": shown_count(page)})
            page.locator(".category-options button", has_text=re.compile(rf"^全部{l1}岗位")).first.click()
            page.locator(".category-dialog").wait_for(state="hidden")
            wait_for_category(page, l1id, "")
            check(surface, f"{l1}: 全部该方向岗位 applies the level-1 alone",
                  param(page, "cat") == l1id and param(page, "sub") == "", page.url)
            check(surface, f"{l1}: level-1 count equals the advertised number", shown_count(page) == advertised_l1,
                  {"shown": shown_count(page), "advertised": advertised_l1})
            # direct clear from the filter bar
            page.get_by_role("button", name="取消岗位类别筛选").click()
            wait_for_category(page, "", "")
            check(surface, f"{l1}: category clears directly", param(page, "cat") == "" and shown_count(page) == baseline,
                  {"url": page.url, "shown": shown_count(page)})

        # --- B2. browsing must never change the current filter ---------------
        open_picker(page)
        index_step(page, narrow)
        open_level1(page, "技术研发", narrow)
        check(surface, "browsing a direction keeps the url untouched", param(page, "cat") == "", page.url)
        check(surface, "browsing a direction keeps the list untouched", shown_count(page) == baseline, shown_count(page))
        open_level1(page, "产品", narrow)
        check(surface, "browsing a second direction keeps the url untouched", param(page, "cat") == "", page.url)
        check(surface, "browsing a second direction keeps the list untouched", shown_count(page) == baseline,
              shown_count(page))
        if narrow:
            page.locator(".category-back").click()
        page.keyboard.press("Escape")
        page.locator(".category-dialog").wait_for(state="hidden")
        check(surface, "escape after browsing changes nothing",
              param(page, "cat") == "" and param(page, "sub") == "" and shown_count(page) == baseline,
              {"url": page.url, "shown": shown_count(page)})
        # the same, but with an existing selection that must survive browsing
        page.goto(BASE + "?cat=product&sub=product.pm", wait_until="networkidle")
        page.locator(".result-line").wait_for(state="visible")
        applied = shown_count(page)
        open_picker(page)
        pressed = page.locator(".category-options button[aria-pressed='true']")
        check(surface, "reopening shows the applied level-2", pressed.count() == 1 and "产品经理" in pressed.first.inner_text(),
              pressed.first.inner_text() if pressed.count() else None)
        open_level1(page, "技术研发", narrow)
        check(surface, "browsing away from the applied category keeps the url",
              param(page, "cat") == "product" and param(page, "sub") == "product.pm", page.url)
        check(surface, "browsing away from the applied category keeps the list",
              shown_count(page) == applied, {"before": applied, "after": shown_count(page)})
        page.get_by_role("button", name="取消").click()
        page.locator(".category-dialog").wait_for(state="hidden")
        check(surface, "取消 after browsing keeps the previous selection",
              param(page, "cat") == "product" and param(page, "sub") == "product.pm" and shown_count(page) == applied,
              {"url": page.url, "shown": shown_count(page)})
        open_picker(page)
        open_level1(page, "技术研发", narrow)
        page.keyboard.press("Escape")
        page.locator(".category-dialog").wait_for(state="hidden")
        check(surface, "escape after browsing keeps the previous selection",
              param(page, "sub") == "product.pm" and shown_count(page) == applied,
              {"url": page.url, "shown": shown_count(page)})
        page.get_by_role("button", name="取消岗位类别筛选").click()
        wait_for_category(page, "", "")
        check(surface, "the previous selection can still be cleared", shown_count(page) == baseline, shown_count(page))

        # --- C. single-job subcategories and 其他 -----------------------------
        open_picker(page)
        index_step(page, narrow)
        open_level1(page, "其他", narrow)
        pane = page.locator(".category-options")
        for label in ("未分类", "非岗位公告"):
            check(surface, f"其他 > {label} is offered", visible(pane.get_by_role("button", name=re.compile(label))))
        pane.get_by_role("button", name=re.compile("非岗位公告")).first.click()
        page.locator(".category-dialog").wait_for(state="hidden")
        wait_for_category(page, "other", "other.announcement")
        check(surface, "single-job category is reachable", shown_count(page) == 1, shown_count(page))
        check(surface, "single-job category keeps its own url", param(page, "sub") == "other.announcement", page.url)
        check(surface, "the announcement is the row shown",
              "全球校园招聘公告" in page.locator(".job-row").first.inner_text(),
              page.locator(".job-row").first.inner_text()[:80])
        page.screenshot(path=str(OUT / f"{surface}-05-single-job.png"))
        open_picker(page)
        index_step(page, narrow)
        open_level1(page, "其他", narrow)
        pane.get_by_role("button", name=re.compile("未分类")).first.click()
        page.locator(".category-dialog").wait_for(state="hidden")
        wait_for_category(page, "other", "other.unknown")
        check(surface, "unclassified stays browsable", shown_count(page) == 1, shown_count(page))
        open_picker(page)
        index_step(page, narrow)
        page.locator(".category-all").first.click()
        page.locator(".category-dialog").wait_for(state="hidden")
        wait_for_category(page, "", "")
        check(surface, "全部类别 restores the full list", shown_count(page) == baseline, shown_count(page))

        # --- D. combination, zero result, history ----------------------------
        ensure_controls(page)
        page.locator('select[name="company"]').select_option("蚂蚁集团")
        page.wait_for_timeout(250)
        company_rows = shown_count(page)
        observe(surface, "蚂蚁集团 rows before category", company_rows)
        open_picker(page)
        index_step(page, narrow)
        advertised = item_count(page, "技术研发")
        open_level1(page, "技术研发", narrow)
        page.locator(".category-options button", has_text=re.compile("^全部技术研发岗位")).first.click()
        page.locator(".category-dialog").wait_for(state="hidden")
        wait_for_category(page, "tech", "")
        combined = shown_count(page)
        check(surface, "category count follows the other filters", combined == advertised,
              {"combined": combined, "advertised": advertised})
        check(surface, "combination keeps both params", param(page, "cat") == "tech" and param(page, "company") == "蚂蚁集团",
              page.url)
        observe(surface, "技术研发 + 蚂蚁集团 rows", combined)
        page.screenshot(path=str(OUT / f"{surface}-06-combined.png"))

        # a combination that cannot match -> explicit empty state with recovery
        # (a keyword nothing can contain keeps this true for any dataset)
        page.goto(BASE + "?cat=tech&q=zzzznomatch", wait_until="networkidle")
        page.locator(".result-line").wait_for(state="visible")
        wait_for_category(page, "tech")
        check(surface, "impossible combination returns zero rows", shown_count(page) == 0, shown_count(page))
        empty_h2 = page.locator(".empty-state h2")
        empty_h2.wait_for(state="visible")
        check(surface, "empty state names the active category", "技术研发" in empty_h2.inner_text(),
              empty_h2.inner_text())
        check(surface, "empty state offers a category-specific recovery",
              visible(page.get_by_role("button", name="清除类别")))
        page.screenshot(path=str(OUT / f"{surface}-07-empty.png"))

        page.go_back()
        wait_for_category(page, "tech", "")
        check(surface, "back restores the previous category state", param(page, "cat") == "tech", page.url)
        page.get_by_role("button", name=re.compile("清除全部筛选")).first.click()
        wait_for_category(page, "", "")
        check(surface, "clearing all filters drops the category", param(page, "cat") == "" and shown_count(page) == baseline,
              {"url": page.url, "shown": shown_count(page)})

        # --- E. stale link recovery -------------------------------------------
        page.goto(BASE + "?cat=nope&sub=nope.nope", wait_until="networkidle")
        page.locator(".result-line").wait_for(state="visible")
        check(surface, "a stale category link does not break the list", shown_count(page) == baseline, shown_count(page))
        check(surface, "a stale category link says so", visible(page.locator(".selection-note")),
              page.locator(".selection-note").inner_text() if visible(page.locator(".selection-note")) else None)
        page.screenshot(path=str(OUT / f"{surface}-08-stale.png"))
        page.goto(BASE + "?cat=tech&sub=product.pm", wait_until="networkidle")
        page.locator(".result-line").wait_for(state="visible")
        # A level-2 that belongs to another level-1 is ignored: the valid level-1
        # still applies, and the URL is not rewritten, so the notice explains it.
        open_picker(page)
        index_step(page, narrow)
        tech_count = item_count(page, "技术研发")
        page.keyboard.press("Escape")
        page.locator(".category-dialog").wait_for(state="hidden")
        check(surface, "an inconsistent pair keeps only the level-1 filter",
              shown_count(page) == tech_count, {"shown": shown_count(page), "tech": tech_count})
        ensure_controls(page)
        check(surface, "an inconsistent pair shows the level-1 on the trigger",
              "技术研发" in page.locator(".category-trigger").inner_text(),
              page.locator(".category-trigger").inner_text())
        check(surface, "an inconsistent pair explains the recovery",
              visible(page.locator(".selection-note")))
        check(surface, "an inconsistent pair is not silently trusted",
              param(page, "sub") == "product.pm" and param(page, "cat") == "tech", page.url)

        # --- F. keyboard and focus -------------------------------------------
        page.goto(BASE, wait_until="networkidle")
        page.locator(".result-line").wait_for(state="visible")
        ensure_controls(page)
        page.focus(".category-trigger")
        page.keyboard.press("Enter")
        page.locator(".category-dialog").wait_for(state="visible")
        check(surface, "keyboard opens the picker onto its title",
              page.evaluate("document.activeElement && document.activeElement.tagName") == "H2")
        page.keyboard.press("Escape")
        page.locator(".category-dialog").wait_for(state="hidden")
        check(surface, "escape restores focus to the trigger",
              "category-trigger" in str(page.evaluate("document.activeElement && document.activeElement.className")),
              page.evaluate("document.activeElement && document.activeElement.className"))
        if narrow:
            open_picker(page)
            page.locator(".category-level1-item", has_text="产品").first.click()
            check(surface, "narrow: focus follows into the level-2 pane",
                  "category-pane-title" in str(page.evaluate("document.activeElement && document.activeElement.className")),
                  page.evaluate("document.activeElement && document.activeElement.className"))
            page.locator(".category-back").click()
            check(surface, "narrow: back returns focus to the index",
                  "category-level1" in str(page.evaluate("document.activeElement && document.activeElement.className")),
                  page.evaluate("document.activeElement && document.activeElement.className"))
            page.keyboard.press("Escape")
            page.locator(".category-dialog").wait_for(state="hidden")
        else:
            open_picker(page)
            page.locator(".category-level1-item", has_text="产品").first.click()
            check(surface, "wide: focus follows into the level-2 pane",
                  "category-pane-title" in str(page.evaluate("document.activeElement && document.activeElement.className")),
                  page.evaluate("document.activeElement && document.activeElement.className"))

        # --- G. tentative categories are marked, preview keeps state ----------
        page.goto(BASE + "?sub=other.unknown", wait_until="networkidle")
        page.locator(".result-line").wait_for(state="visible")
        page.locator(".job-row").first.click()
        peek = page.locator(".detail-pane, .peek-overlay").first
        peek.wait_for(state="visible")
        detail = peek.inner_text()
        check(surface, "preview shows the job category", "岗位类别：" in detail, detail[:120])
        check(surface, "a tentative category is marked as unverified", "岗位类别待核实" in detail, detail[:200])
        check(surface, "preview keeps the category in the url", param(page, "sub") == "other.unknown", page.url)
        link = peek.locator('a[href*="/jobs/"]').first.get_attribute("href")
        decoded = unquote(link or "")
        check(surface, "full detail link carries the category back",
              link is not None and "sub=other.unknown" in decoded, decoded)
        page.screenshot(path=str(OUT / f"{surface}-09-tentative.png"))
        tentative = page.locator(".category-note")
        check(surface, "the filter bar states how many categories are tentative",
              "待核实" in page.locator(".browse-actions").inner_text(),
              page.locator(".browse-actions").inner_text())
        browser.close()


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for surface, width, height in (("desktop", 1440, 900), ("mobile", 390, 844)):
        run(surface, width, height)
    (OUT / "results.json").write_text(
        json.dumps({"base": BASE, "results": results, "observations": observations}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    passed = sum(1 for r in results if r["pass"])
    print(json.dumps({"base": BASE, "checks": len(results), "passed": passed, "artifacts": str(OUT)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
