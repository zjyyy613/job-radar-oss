# Job Radar brand assets

Vector reconstruction of the user's frozen reference `codex-clipboard-756ea0df-a8c0-4da1-b7a8-47bc4c0a2a78.png` (2026-10-01). No new concept or typeface substitution.

- `brand-wordmark.svg`: hand-maintained paths for Job Radar; custom open radar o with dot, custom cut R. Each letter has a named path. Uses evenodd counters; no fonts required.
- `brand-mark.svg`: the same custom R path as the wordmark, with its own viewBox.
- `favicon.svg`: optical simplification of the same R for 16–32px; thicker small upper wedge and explicit open diagonal gap. Not a separate logo concept.

All assets are transparent, monochrome #1D1D1B. No bitmap, text element, external font, gradient, shadow, filter, or mockup background. Source coordinates are intentionally preserved for easier reference comparison. No claim of original font identification or mathematically exact recovery from raster.

Clear space is included in viewBox: wordmark at least 20 source units around visible paths (about one standard stem width); main R 20 units around the mark; favicon at least 2 units on a 16-unit canvas. Keep these margins when sizing; do not crop to the path bounds, stretch, or add a rounded tile to the asset. Browser icons use favicon.svg; larger uses should use brand-mark.svg. The existing Sidebar/header uses both mark and wordmark at the previous compact footprint.

Small-size proof: `docs/reports/assets/task7-brand-assets/vector-size-proof.png`, rendered at device scale 1 at 16/20/24/32 CSS px on the light canvas and white. The 16px favicon intentionally drops subpixel delicacy; the complete wordmark should not be used as a favicon.
