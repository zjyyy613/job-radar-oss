"""Location picker acceptance (PRODUCT-02 / 02.1).

Drives the real `CityChoice` component in Chromium at desktop and mobile sizes and
records what it verified. Read-only: it never writes product data.

Usage:
    # against a local server that has job data (needs server credentials in .env.local)
    python tests/browser/province_grouping.py
    CITY_BASE_URL=http://127.0.0.1:3111/citycheck-tmp python tests/browser/province_grouping.py

The artefacts under docs/reports/assets/location-picker-v2 were recorded against a
temporary harness that rendered the real CityChoice with the real corpus options,
because `/radar` needs server credentials this workspace does not hold. Grouping,
index/pane interaction, search, keyboard, focus, scroll and layout are exercised on
the real component; URL/Clear/matchesCity behaviour stays covered by the unit tests.

Environment:
    CITY_BASE_URL  page under test (default: http://127.0.0.1:3000/radar)
    CITY_OUT       artifact directory for screenshots + results JSON
    CITY_GROUPS    expected group count for this corpus (default 31)
    CITY_CHROME    explicit Chromium executable when the cached build differs from
                   the installed Playwright version
"""
import json
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get("CITY_BASE_URL", "http://127.0.0.1:3000/radar")
OUT = pathlib.Path(os.environ.get("CITY_OUT", "docs/reports/assets/location-picker-v2"))
CHROME = os.environ.get("CITY_CHROME") or None
TRIGGER = ".city-trigger"
EXPECTED_GROUPS = int(os.environ.get("CITY_GROUPS", "31"))

results: list[dict[str, object]] = []


def check(surface: str, name: str, ok: bool, detail: object = None) -> None:
    results.append({"surface": surface, "check": name, "pass": bool(ok), "detail": detail})
    if not ok:
        raise AssertionError(f"[{surface}] {name}: {detail}")


def visible(locator) -> bool:
    try:
        return locator.is_visible()
    except Exception:  # noqa: BLE001 - a detached/strict locator is simply not visible
        return False


def open_dialog(page, dialog) -> None:
    page.focus(TRIGGER)
    page.keyboard.press("Enter")
    dialog.wait_for(state="visible")


def run(surface: str, width: int, height: int) -> None:
    narrow = width < 768
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME) if CHROME else p.chromium.launch()
        page = browser.new_page(viewport={"width": width, "height": height})
        page.goto(BASE, wait_until="networkidle")
        dialog = page.locator('[role="dialog"]')
        open_dialog(page, dialog)

        # 1. Opening and initial focus.
        focused_tag = page.evaluate("document.activeElement && document.activeElement.tagName")
        check(surface, "dialog opens from keyboard", True)
        check(surface, "focus moves into the dialog title", focused_tag == "H2", focused_tag)
        cancel = page.get_by_role("button", name="取消").bounding_box()
        check(surface, "cancel is reachable without scrolling the dialog",
              cancel is not None and cancel["y"] + cancel["height"] <= height + 1, cancel)

        # 2. Index and city pane.
        check(surface, "province index rendered", page.locator(".city-province").count() == EXPECTED_GROUPS,
              page.locator(".city-province").count())
        check(surface, "city pane exists", page.locator(".city-cities").count() == 1)
        if narrow:
            check(surface, "narrow layout shows one step at a time",
                  visible(page.locator(".city-index")) and not visible(page.locator(".city-cities")))
        else:
            check(surface, "wide layout shows index and cities together",
                  visible(page.locator(".city-index")) and visible(page.locator(".city-cities")))
            check(surface, "dialog is wider than the old single-column picker",
                  page.locator('[data-slot="dialog-content"]').bounding_box()["width"] > 600,
                  page.locator('[data-slot="dialog-content"]').bounding_box())
        check(surface, "province grid uses columns",
              page.evaluate("getComputedStyle(document.querySelector('.city-provinces')).gridTemplateColumns.split(' ').length") >= 3,
              page.evaluate("getComputedStyle(document.querySelector('.city-provinces')).gridTemplateColumns"))

        # 3. The fast path stays one click: 北京 is not behind a province step.
        check(surface, "Beijing is one click away", visible(page.locator(".city-quick").get_by_role("button", name="北京", exact=True)))
        check(surface, "Hong Kong quick entry present", visible(page.locator(".city-quick").get_by_role("button", name="香港", exact=True)))

        # 4. Province -> city: 广东省 shows 广州/深圳/东莞 in the adjacent pane.
        if not narrow:
            check(surface, "city pane starts without a province", visible(page.locator(".city-pane-empty")))
        page.locator(".city-province", has_text="广东").first.click()
        cities_pane = page.locator(".city-cities")
        for city in ("广州", "深圳", "东莞"):
            check(surface, f"{city} listed after choosing 广东省", visible(cities_pane.get_by_role("button", name=city)))
        check(surface, "chosen province marked",
              page.locator('.city-province[aria-current="true"]').inner_text().strip() == "广东",
              page.locator('.city-province[aria-current="true"]').inner_text())
        check(surface, "focus follows into the city pane",
              page.evaluate("document.activeElement && document.activeElement.className") == "city-pane-title",
              page.evaluate("document.activeElement && document.activeElement.className"))
        if narrow:
            check(surface, "narrow step hides the index",
                  not visible(page.locator(".city-index")) and visible(page.locator(".city-back")))
        page.screenshot(path=str(OUT / f"{surface}-province-guangdong.png"))

        # 5. Selecting writes the city (never the province) and closes.
        cities_pane.get_by_role("button", name="广州", exact=True).click()
        dialog.wait_for(state="hidden")
        check(surface, "trigger shows the chosen city", "广州" in page.locator(TRIGGER).inner_text(), page.locator(TRIGGER).inner_text())
        selected = page.locator("[data-testid=selected]")
        if selected.count():
            check(surface, "callback received the city, not the province", selected.inner_text().strip() == "selected=广州", selected.inner_text())
        check(surface, "focus returns to the trigger", "city-trigger" in str(page.evaluate("document.activeElement && document.activeElement.className")))

        # 6. Reopening returns to the selection's province with it marked.
        open_dialog(page, dialog)
        check(surface, "reopen keeps the selection's province active",
              page.locator('.city-province[aria-current="true"]').inner_text().strip() == "广东")
        check(surface, "reopen marks the selected city",
              visible(cities_pane.get_by_role("button", name="广州")) and
              cities_pane.get_by_role("button", name="广州").get_attribute("aria-pressed") == "true")
        if narrow:
            page.locator(".city-back").click()
            check(surface, "back returns to the province index",
                  visible(page.locator(".city-index")) and not visible(page.locator(".city-cities")))
            check(surface, "back moves focus to the index",
                  page.evaluate("document.activeElement && document.activeElement.className") == "city-provinces",
                  page.evaluate("document.activeElement && document.activeElement.className"))

        # 7. Search reaches a city whose province was never opened.
        search = page.get_by_role("searchbox")
        search.fill("太原")
        check(surface, "collapsed province city found by search", visible(page.get_by_role("button", name="太原")))
        check(surface, "search replaces the panes", page.locator(".city-picker").count() == 0)
        check(surface, "search narrows to the matching group", page.locator(".city-group").count() == 1, page.locator(".city-group").count())
        page.screenshot(path=str(OUT / f"{surface}-search-taiyuan.png"))
        search.fill("广东")
        check(surface, "province name search lists its cities",
              visible(page.get_by_role("button", name="广州")) and visible(page.get_by_role("button", name="深圳")))
        search.fill("中国香港")
        check(surface, "raw SAR alias searchable", visible(page.get_by_role("button", name="中国香港")))
        search.fill("不存在的地点")
        check(surface, "empty search states so", visible(page.get_by_role("status")), page.locator("[role=status]").inner_text())
        search.fill("")

        # 8. Keyboard-only selection from the search field.
        search.fill("太原")
        page.keyboard.press("Tab")
        first = page.evaluate("document.activeElement.textContent.trim()")
        check(surface, "tab order starts at 全部地点", first == "全部地点", first)
        page.keyboard.press("Tab")
        second = page.evaluate("document.activeElement.textContent.trim()")
        check(surface, "tab reaches the matched option", second == "太原", second)
        page.keyboard.press("Enter")
        dialog.wait_for(state="hidden")
        check(surface, "keyboard selection applies", "太原" in page.locator(TRIGGER).inner_text(), page.locator(TRIGGER).inner_text())

        # 9. The three repaired classifications are visible where they belong.
        def index_step() -> None:
            """On the narrow layout the picker reopens on the selection's province."""
            if narrow and not visible(page.locator(".city-index")):
                page.locator(".city-back").click()

        open_dialog(page, dialog)
        index_step()
        page.locator(".city-province", has_text="浙江").first.click()
        zhejiang = page.locator(".city-cities")
        check(surface, "浙江 filed under 浙江省", visible(zhejiang.get_by_role("button", name="浙江")))
        check(surface, "浙江 marked as having no city", visible(zhejiang.locator(".city-hint", has_text="未注明城市")))
        page.screenshot(path=str(OUT / f"{surface}-province-zhejiang.png"))
        index_step()
        page.locator(".city-province", has_text="海南").first.click()
        check(surface, "海南省-澄迈县 filed under 海南省", visible(page.locator(".city-cities").get_by_role("button", name="海南省-澄迈县")))
        index_step()
        page.locator(".city-province", has_text="香港").first.click()
        check(surface, "中国香港 filed under 香港特别行政区", visible(page.locator(".city-cities").get_by_role("button", name="中国香港")))
        page.screenshot(path=str(OUT / f"{surface}-repaired-groups.png"))
        index_step()
        page.locator(".city-quick").get_by_role("button", name="北京", exact=True).click()
        dialog.wait_for(state="hidden")
        check(surface, "Beijing selected in one click", "北京" in page.locator(TRIGGER).inner_text(), page.locator(TRIGGER).inner_text())

        # 10. Scroll containment and layout integrity.
        open_dialog(page, dialog)
        metrics = page.evaluate(
            """() => { const grid = document.querySelector('.city-provinces');
                 const buttons = Array.from(grid.querySelectorAll('button')).filter(b => b.getBoundingClientRect().height > 0);
                 const quick = Array.from(document.querySelectorAll('.city-quick button')).filter(b => b.getBoundingClientRect().height > 0);
                 const box = document.querySelector('[data-slot="dialog-content"]').getBoundingClientRect();
                 return { gridScrolls: grid.scrollHeight > grid.clientHeight,
                          gridHeight: Math.round(grid.getBoundingClientRect().height),
                          paneShare: grid.getBoundingClientRect().height / window.innerHeight,
                          dialogBottom: Math.round(box.bottom), viewport: window.innerHeight,
                          overflowX: document.scrollingElement.scrollWidth - window.innerWidth,
                          provinces: buttons.length, quick: quick.length,
                          minTarget: buttons.length ? Math.min(...buttons.map(b => b.getBoundingClientRect().height)) : 0,
                          minQuick: quick.length ? Math.min(...quick.map(b => b.getBoundingClientRect().height)) : 0 }; }"""
        )
        check(surface, "no horizontal overflow", metrics["overflowX"] <= 1, metrics)
        check(surface, "measured real grid buttons", metrics["provinces"] >= 24, metrics)
        # 44px is the touch minimum; desktop is pointer-driven and runs slightly denser.
        target = 44 if narrow else 40
        check(surface, f"province targets >= {target}px", metrics["minTarget"] >= target, metrics)
        check(surface, f"quick targets >= {target}px", metrics["minQuick"] >= target, metrics)
        check(surface, "dialog stays inside the viewport", metrics["dialogBottom"] <= metrics["viewport"], metrics)
        check(surface, "province pane stays bounded", metrics["paneShare"] <= 0.6, metrics)
        if narrow:
            check(surface, "narrow index scrolls inside its own pane, not the page", metrics["gridScrolls"], metrics)
        else:
            # The multi-column index is meant to remove the long scroll entirely.
            check(surface, "wide index needs no scrolling", not metrics["gridScrolls"], metrics)
        page.screenshot(path=str(OUT / f"{surface}-index.png"))
        browser.close()


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for surface, width, height in (("desktop", 1440, 900), ("mobile", 390, 844)):
        run(surface, width, height)
    (OUT / "results.json").write_text(json.dumps({"base": BASE, "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
    passed = sum(1 for r in results if r["pass"])
    print(json.dumps({"base": BASE, "checks": len(results), "passed": passed, "artifacts": str(OUT)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
