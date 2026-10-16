"""Province-grouped location selector acceptance (PRODUCT-02).

Drives the real `CityChoice` component in Chromium at desktop and mobile sizes and
records what it verified. Read-only: it never writes product data.

Usage:
    # against a local server that has job data (needs server credentials in .env.local)
    python tests/browser/province_grouping.py
    CITY_BASE_URL=http://127.0.0.1:3111/citycheck-tmp python tests/browser/province_grouping.py

The artefacts under docs/reports/assets/province-grouping-v1 were recorded against a
temporary harness that rendered the real CityChoice with the 56 real corpus options,
because `/radar` needs server credentials this workspace does not hold. Grouping,
expansion, search, keyboard, focus, scroll and layout are exercised on the real
component; URL/Clear/matchesCity behaviour stays covered by the unit tests.

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
OUT = pathlib.Path(os.environ.get("CITY_OUT", "docs/reports/assets/province-grouping-v1"))
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


def run(surface: str, width: int, height: int) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME) if CHROME else p.chromium.launch()
        page = browser.new_page(viewport={"width": width, "height": height})
        page.goto(BASE, wait_until="networkidle")

        # 1. Keyboard opening and initial focus management.
        page.focus(TRIGGER)
        page.keyboard.press("Enter")
        dialog = page.locator('[role="dialog"]')
        dialog.wait_for(state="visible")
        check(surface, "dialog opens from keyboard", True)
        focused_tag = page.evaluate("document.activeElement && document.activeElement.tagName")
        focused_text = page.evaluate("document.activeElement && document.activeElement.textContent")
        check(surface, "focus moves into the dialog title", focused_tag == "H2", {"tag": focused_tag, "text": focused_text})

        # 2. Group structure: provinces are an index, not a filter.
        groups = page.locator(".city-group")
        check(surface, "group count", groups.count() == EXPECTED_GROUPS, groups.count())
        labels = page.locator(".city-group-toggle span").all_inner_texts()
        check(surface, "municipalities grouped first", labels[:4] == ["北京市", "上海市", "天津市", "重庆市"], labels[:4])
        check(surface, "special buckets last", labels[-3:] == ["香港特别行政区", "境外", "其他地点"], labels[-3:])
        check(surface, "guangdong present", "广东省" in labels, labels[:8])

        # 3. Default expansion: municipalities open, mainland provinces collapsed.
        check(surface, "municipality option reachable without expanding", visible(page.get_by_role("button", name="北京", exact=True)))
        check(surface, "province collapsed by default", not visible(page.get_by_role("button", name="广州", exact=True)))
        check(surface, "collapsed toggle reports aria-expanded=false",
              page.get_by_role("button", name="广东省").get_attribute("aria-expanded") == "false")

        # 4. Expanding a province reveals exactly its cities (no implicit province filter).
        page.get_by_role("button", name="广东省").click()
        check(surface, "expanded toggle reports aria-expanded=true",
              page.get_by_role("button", name="广东省").get_attribute("aria-expanded") == "true")
        for city in ("广州", "深圳", "东莞"):
            check(surface, f"{city} visible after expanding 广东省", visible(page.get_by_role("button", name=city, exact=True)))
        check(surface, "unrelated province stays collapsed",
              not visible(page.get_by_role("button", name="太原", exact=True)))
        page.screenshot(path=str(OUT / f"{surface}-expanded-guangdong.png"))

        # 5. Selecting a city closes the dialog and reports the city (never the province).
        page.get_by_role("button", name="广州", exact=True).click()
        dialog.wait_for(state="hidden")
        trigger_text = page.locator(TRIGGER).inner_text()
        check(surface, "trigger shows the chosen city", "广州" in trigger_text, trigger_text)
        selected = page.locator("[data-testid=selected]")
        if selected.count():
            check(surface, "callback received the city, not the province", selected.inner_text().strip() == "selected=广州", selected.inner_text())
        focus_back = page.evaluate("document.activeElement && document.activeElement.className")
        check(surface, "focus returns to the trigger", TRIGGER.strip(".") in str(focus_back), focus_back)

        # 6. Reopening resets the search and the expansion overrides.
        page.focus(TRIGGER)
        page.keyboard.press("Enter")
        dialog.wait_for(state="visible")
        check(surface, "search resets on reopen", page.get_by_role("searchbox").input_value() == "")
        check(surface, "expansion resets on reopen", not visible(page.get_by_role("button", name="广州", exact=True)))
        check(surface, "selected city keeps its group expanded",
              page.get_by_role("button", name="广东省").get_attribute("aria-expanded") == "true")

        # 7. Search reaches a city whose province was never expanded (requirement 7).
        search = page.get_by_role("searchbox")
        search.fill("太原")
        check(surface, "collapsed province city found by search", visible(page.get_by_role("button", name="太原", exact=True)))
        check(surface, "search narrows to the matching group", page.locator(".city-group").count() == 1, page.locator(".city-group").count())
        page.screenshot(path=str(OUT / f"{surface}-search-taiyuan.png"))

        # 8. A province name reveals its cities even while collapsed.
        search.fill("广东")
        guangdong = page.locator(".city-group").filter(has_text="广东省")
        check(surface, "province search narrows to that province", page.locator(".city-group").count() == 1, page.locator(".city-group").count())
        for city in ("广州", "深圳", "东莞"):
            option = guangdong.get_by_role("button", name=city)
            check(surface, f"{city} found by province name search", option.count() == 1 and visible(option.first),
                  {"count": option.count()})

        # 9. Keyboard-only selection from the search field, following the real tab order.
        search.fill("太原")
        page.keyboard.press("Tab")
        first_stop = page.evaluate("document.activeElement.textContent.trim()")
        check(surface, "tab order starts at 全部地点", first_stop == "全部地点", first_stop)
        page.keyboard.press("Tab")
        second_stop = page.evaluate("document.activeElement.textContent.trim()")
        check(surface, "tab reaches the matched option", second_stop == "太原", second_stop)
        page.keyboard.press("Enter")
        dialog.wait_for(state="hidden")
        check(surface, "keyboard selection applies", "太原" in page.locator(TRIGGER).inner_text(), page.locator(TRIGGER).inner_text())

        # 10. Empty search state is explicit.
        page.focus(TRIGGER)
        page.keyboard.press("Enter")
        dialog.wait_for(state="visible")
        page.get_by_role("searchbox").fill("不存在的地点")
        check(surface, "empty search states so", visible(page.get_by_role("status")), page.locator("[role=status]").inner_text())
        page.get_by_role("searchbox").fill("")
        page.screenshot(path=str(OUT / f"{surface}-open.png"))

        # 11. Scroll containment and layout integrity.
        metrics = page.evaluate(
            """() => { const box = document.querySelector('.city-options');
                 const options = Array.from(document.querySelectorAll('.city-group-options button'))
                   .filter(b => b.getBoundingClientRect().height > 0);
                 return { scrollHeight: box.scrollHeight, clientHeight: box.clientHeight,
                          overflowX: document.scrollingElement.scrollWidth - window.innerWidth,
                          visibleOptions: options.length,
                          minOption: options.length ? Math.min(...options.map(b => b.getBoundingClientRect().height)) : 0 }; }"""
        )
        check(surface, "option list scrolls inside the dialog", metrics["scrollHeight"] > metrics["clientHeight"], metrics)
        check(surface, "no horizontal overflow", metrics["overflowX"] <= 1, metrics)
        check(surface, "measured real option buttons", metrics["visibleOptions"] >= 4, metrics)
        check(surface, "touch targets >= 44px", metrics["minOption"] >= 44, metrics)

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
