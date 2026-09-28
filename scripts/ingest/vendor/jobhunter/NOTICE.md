# JobHunter NCSS adaptation

- Upstream: https://github.com/Bynlk/JobHunter
- Pinned commit: `4b5a69010a98b3d80b408fd983c1c2dfa60788e4`
- Source: https://github.com/Bynlk/JobHunter/blob/4b5a69010a98b3d80b408fd983c1c2dfa60788e4/crawler/ncss_crawler.py
- Original file SHA-256: `6aa18c922c58b4d0ff261ccd4d62713b35ccc000cc7718d7262620fcf8c84143`
- License: MIT; full upstream notice in `LICENSE` beside this file.

`../../ncss-adapter.py` adapts the NCSS page/session initialization, same-origin
Playwright fetch, endpoint/query parameters, jobId detail URL, and source field
mapping from this exact revision. It is a local, reviewed extraction; runtime
does not download code or follow a branch. Upgrades require fixture/smoke review.

Removed: BaseCrawler/config imports, Flask/SQLite/Vue, generic detail scraping,
pagination, title-based recruitment inference, salary rounding and swallowed
errors. Retained: one bounded first-page fetch after the upstream 5-second
session wait. Added response validation, timeouts, raw payload and explicit nulls.
Playwright is separately pinned; no stealth plugin or other upstream dependencies.
