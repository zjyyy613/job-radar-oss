# Curated company brands

Resolution is strictly **verified curated asset → neutral company-initial fallback**.
Only an exact normalized canonical company identity is accepted: NFKC, trimmed/collapsed whitespace, lowercase (same rule as canonicalization). No suffix stripping, alias guessing, fuzzy names, source-domain, recruiting-domain or ATS lookup. No network logo API or favicon fallback.

## Reviewed retained assets — 2026-10-01

| Normalized identity | Local asset | Identity review |
| --- | --- | --- |
| 小米 | xiaomi.ico | Existing orange mi corporate mark, visually reviewed; retain unchanged. Originally retrieved from https://www.mi.com/favicon.ico on 2026-09-30. |
| 中国银行股份有限公司 | boc.ico | Existing red Bank of China corporate emblem, visually reviewed; retain unchanged. Originally retrieved from https://www.boc.cn/favicon.ico on 2026-09-30. |

A favicon URL is acquisition history, **not evidence by itself that an asset represents its company**. These two existing recognizable company marks are retained for identification beside the actual company name, without endorsement claims. Trademark ownership remains with its owner; this record does not assert a broad redistribution license or legal clearance.

## Excluded / fallback

- 腾讯 (2 jobs): removed `tencent.png`. Its previous Tencent-site favicon provenance did not establish corporate identity; the user confirmed it was a subsidiary/product-style mark. No manually approved corporate alternative with suitable documented usage was found in the repository. Use 腾; do not download a substitute.
- vivo (2 jobs): removed `vivo.ico` from serving assets. Existing blue V-shaped favicon has insufficient company-level identity confirmation in the local provenance record. Use V pending a separately confirmed asset; this is uncertainty, not a claim that it is definitely another company's mark.
- 保禄翊腾（浙江）包装新材料有限公司 (1 job): no approved asset, retain 保 fallback.
- Unknown identities and image load errors: retain the same first-character fallback. Never retry an unknown favicon.

Only `src/lib/radar/company-brand.ts` admits assets. New entries require explicit company identity/asset review and a provenance record; deriving a filename from a website is not admission. Historical screenshots remain design history, not production assets.

No CSS or size change: desktop JobRow 28px graphic / 34px neutral container; mobile 18px / 24px; existing fallback styling unchanged.
