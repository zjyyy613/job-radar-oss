# Brand Asset Vectorization

日期：2026-10-01。唯一品牌参考为用户冻结的 `codex-clipboard-756ea0df-a8c0-4da1-b7a8-47bc4c0a2a78.png`。本轮未生成新概念，未修改其余 Task 7 UI、IA 或数据语义。

## 资产

- `public/brand/brand-mark.svg`：独立 stylized R，与 wordmark R 共用同一轮廓数据。
- `public/brand/brand-wordmark.svg`：完整 Job Radar，逐字命名 path；保留 o 的开口与雷达圆点、R 的切线与下斜腿。
- `public/brand/favicon.svg`：16–32px 的同轮廓光学校正，强化原本易消失的细楔形及开放斜缝。
- `public/brand/README.md`：来源、维护及 clear space 说明。

纯 SVG path，无 text/font 依赖，无 bitmap/base64、渐变、阴影或 filter。填色统一 #1D1D1B，透明背景；没有把参考图的圆角展示底板带入资产。wordmark 与大 R 的 viewBox 保留约一条标准竖笔画宽度的 clear space，favicon 保留至少 2/16 的边距。由位图手工重建可维护曲线，不声称取得原设计矢量母版或准确识别原字体。

## 接入与修改

- `src/components/app-shell.tsx`：仅替换品牌 link 内 placeholder 为独立 R + SVG 字标；aria-label 为 Job Radar，图像为空 alt 避免重复朗读。导航 Radar 图标未更改。
- `src/app/layout.tsx`：metadata icon 指向 `/brand/favicon.svg`。
- `src/app/globals.css`：只新增品牌图像尺寸；768–1023px 窄 Sidebar 的字标等比缩至 88px，其余为 112px，避免溢出。无其他 UI 样式变更。

## 验证

- lint / typecheck / build：最终版本通过。
- tests：17 files / 292 tests 通过。
- XML 检查：三个 SVG 仅含 svg/title/path，无外部引用或图像。
- 实际 Chrome 1× 像素校样：16 / 20 / 24 / 32px 的 Mark 与 favicon，浅色 canvas 和白色 surface；16px 使用简化 favicon，保留可辨的上碗、斜缝与下腿。完整字标在大尺寸校样核对 o 和 R。
- 实际 browser：SVG 正常解码；品牌 link 无障碍名称正确；favicon link 正确、HTTP 200、SVG MIME 正确。校验的是页面 icon 声明与资源响应，小尺寸外观由校样核验，未声称自动化读到了 Chrome tab chrome。
- 320 / 390 / 768 / 1023 / 1600：页面及品牌槽位无横向溢出。首次发现 768px 品牌溢出，局部缩放后复查通过，未改 Sidebar 宽度。
- 最终真实截图：仍 8 条岗位、原本科 2027/机械工程 Profile、5 Eligible/3 Blocked，选中 vivo 与逐字 evidence 不变，无 pageerror。
- diff check：通过，仅已有换行符提示。

## 截图

- [桌面 Sidebar / Radar](assets/task7-brand-assets/desktop-browse.png)
- [移动 header / Radar](assets/task7-brand-assets/mobile-radar.png)
- [16–32px 及字标校样](assets/task7-brand-assets/vector-size-proof.png)

另保存 desktop-inspect、mobile-detail、mobile-filters、mobile-full-detail，便于复核。SVG 仅在品牌位置接入，没有改公司 logo 或其他 Task 7 页面内容。

停止并等待最终 M0 验收；未进入 M1，未自动 Freeze 或提交。
