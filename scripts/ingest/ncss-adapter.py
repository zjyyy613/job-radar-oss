"""NCSS-only adaptation of JobHunter; see vendor/jobhunter/NOTICE.md and LICENSE."""
import copy
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
import os
import re
import time
from urllib.parse import quote, urlencode

JOBHUNTER_COMMIT = "4b5a69010a98b3d80b408fd983c1c2dfa60788e4"
ADAPTER_VERSION = f"ncss-v1-jobhunter-{JOBHUNTER_COMMIT}"
PROVENANCE = {"source": "ncss", "source_family": "public_employment", "source_tier": "trusted_aggregator"}
BASE_URL = "https://www.ncss.cn/student/jobs/index.html"
API_URL = "https://www.ncss.cn/student/jobs/jobslist/ajax/"


def text(value):
    return value.strip() if isinstance(value, str) and value.strip() else None


def salary(raw):
    try:
        low = Decimal(str(raw.get("lowMonthPay")))
        high = Decimal(str(raw.get("highMonthPay")))
        if not low.is_finite() or not high.is_finite() or low <= 0 or high < low:
            return None
        return f"{format(low.normalize(), 'f')}K-{format(high.normalize(), 'f')}K/月"
    except InvalidOperation:
        return None


def published_at(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
        return None
    try:
        return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    except (ValueError, OverflowError, OSError):
        return None


def map_record(raw, fetched_at):
    if not isinstance(raw, dict) or not all(text(raw.get(key)) for key in ("jobId", "jobName", "recName")):
        raise ValueError("NCSS record lacks identity/title/company")
    location = text(raw.get("areaCodeName"))
    tags = text(raw.get("recTags"))
    return {
        **PROVENANCE, "source_job_id": raw["jobId"].strip(),
        "source_url": f"https://www.ncss.cn/student/jobs/{quote(raw['jobId'].strip(), safe='')}/detail.html",
        "company": raw["recName"].strip(), "title": raw["jobName"].strip(),
        "location": [location] if location else [],
        "internship_type": None, "recruitment_batch": None,
        "salary": salary(raw),
        "industry": text(raw.get("industrySectorsName")) or text(raw.get("industryName")),
        "company_nature": text(raw.get("recProperty")), "company_size": text(raw.get("recScale")),
        "welfare": [part.strip() for part in re.split("[，,]", tags) if part.strip()] if tags else [],
        "published_at": published_at(raw.get("publishDate")), "deadline": None,
        "description": None, "requirements": None, "apply_url": None,
        "fetched_at": fetched_at, "last_seen_at": fetched_at,
        "raw_hash": hashlib.sha256(json.dumps(raw, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest(),
        "raw_payload": copy.deepcopy(raw),
    }


def parse_response(payload, limit):
    if not isinstance(payload, dict) or payload.get("flag") is not True:
        raise ValueError("NCSS response rejected")
    data = payload.get("data")
    if not isinstance(data, dict) or not isinstance(data.get("list"), list):
        raise ValueError("NCSS response schema changed")
    rows = data["list"]
    if len(rows) > limit or (not rows and data.get("pagenation", {}).get("count", 0)):
        raise ValueError("NCSS response count mismatch")
    return rows


def fetch_records(limit):
    # Import lazily: contract tests need only the Python standard library.
    from playwright.sync_api import sync_playwright

    params = dict.fromkeys(("jobType", "areaCode", "jobName", "monthPay", "industrySectors", "property", "categoryCode", "memberLevel", "recruitType", "keyUnits", "degreeCode", "sourcesType"), "")
    params.update(offset=1, limit=limit, sourcesName=0, _=int(time.time() * 1000))
    # Do not pass server credentials into Chromium's process environment.
    browser_env = {key: value for key, value in os.environ.items() if key.upper() in {
        "PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE", "LOCALAPPDATA", "DISPLAY", "XDG_RUNTIME_DIR"
    }}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, env=browser_env)
        try:
            page = browser.new_page()
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(5000)  # upstream NCSS session initialization
            payload = page.evaluate("""async url => {
                const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
                if (!response.ok) throw new Error('NCSS HTTP failure');
                return await response.json();
            }""", API_URL + "?" + urlencode(params))
            return parse_response(payload, limit)
        finally:
            browser.close()
