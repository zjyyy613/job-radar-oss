# Company Brand Asset Pack v1

Admission priority: **official brand asset > trusted open-source brand SVG library > neutral fallback**. Runtime resolution: **reviewed local mapping > company initial**. No domain lookup, logo API, ATS/recruiting favicon, product icon, fuzzy match, or runtime CDN.

`manifest.json` records all current companies and seven future reservations. `src/lib/radar/company-brand.ts` contains only admitted exact normalized identities (NFKC / whitespace / lowercase, matching canonicalization). Tests check provenance hashes and mapping consistency. Reserved entries have no downloaded asset and cannot trigger image requests.

## Current assets

- Xiaomi: pinned Simple Icons 16.33.0 corporate mi SVG, upstream orange; replaces the former ICO with the same brand identity.
- vivo: pinned Simple Icons 16.33.0 corporate vivo wordmark SVG, upstream blue; not the rejected V-shaped favicon.
- Bank of China: retain the previously reviewed official red corporate emblem ICO unchanged. Its acquisition URL happens to be a favicon; identity is independently checked against the official corporate emblem explanation. No verified SVG obtained in this bounded review; no tracing or invented replacement.
- Tencent: fallback. Official media resource terms limit use to editorial/media reporting; suitable Job Radar permission is not established. Do not substitute Tencent Hy.
- 保禄翊腾（浙江）包装新材料有限公司: fallback; no verified company asset established.

SVG geometry is unchanged; the only adaptation is a root fill using the upstream brand color. Upstream commit and both upstream/local SHA-256 hashes are recorded. `SIMPLE-ICONS-LICENSE.md` and `SIMPLE-ICONS-DISCLAIMER.md` are retained verbatim. Library CC0 is not a grant of trademark rights or a claim that every brand has unrestricted use. Assets identify the named company; no endorsement is implied.

## Future admission

ByteDance / Alibaba / Meituan / Huawei / JD / NetEase / Baidu are **reservations only**, not enabled brands. When a real canonical company appears, verify its exact identity, official source and use terms; prefer an official corporate asset, otherwise review the pinned library corporate SVG. Download only then, update manifest and mapping together, and verify hash, rendering, identity and fallback. Do not strip company suffixes or automatically admit similar names.

Tencent / Alibaba / Meituan have usage restrictions recorded in the manifest. Huawei's linked guideline was inaccessible during this review. JD / NetEase lack a matching corporate SVG in the pinned library; NetEase Cloud Music is not a substitute. These are explicit pending items, not approved assets.

Desktop remains 28px graphic / 34px container; mobile remains 18px / 24px. No CSS, layout, profile, qualification or source behavior changes. Image load failure retains the existing neutral initial fallback.
