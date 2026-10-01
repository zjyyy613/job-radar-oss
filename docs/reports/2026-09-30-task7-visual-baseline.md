# Task 7 — First-pass runnable UI / Visual Baseline

日期：2026-09-30。基线 commit：82c63f8。Task 7 实现保留在工作区，尚未最终验收或提交。按用户补充要求，暂停最终视觉 polish，等待截图审查；不安装 Hallmark，不进入 M1。

## 真实截图

截图来自本机 Chrome、最新 production build、真实 Supabase jobs；没有 mock marketing 页面或故障注入。Desktop 1440×1000，Mobile 390×844。

通过真实 Onboarding 表单保存验收 Profile：在校、2027 届、本科、机械工程；days/week、duration、research_areas 为 null，偏好为空。该 Profile 仅用于验收，不代表用户本人的资料。

- [Desktop Browse](assets/task7-baseline/desktop-browse.png)
- [Desktop Inspect](assets/task7-baseline/desktop-inspect.png)
- [Mobile Radar](assets/task7-baseline/mobile-radar.png)
- [Mobile Detail Peek](assets/task7-baseline/mobile-detail.png)
- [Mobile Full Detail](assets/task7-baseline/mobile-full-detail.png)

## 已完成的功能链路

- 服务器读取 canonical fields、readiness/hash、gates、原文、投递 URL、source/freshness。密钥仅在 server-only 模块，优先 SUPABASE_SECRET_KEY。
- Radar/Profile 双入口，Browse 默认无选中；搜索、地点/资格筛选、资格优先或 freshness 排序、result count；Blocked 默认保留。
- nuqs 保持 q/city/status/sort/job，刷新和 Back/Forward 恢复，invalid selected job 可返回列表。
- >=1280px 可调整/关闭 Peek，像素宽度本地持久化；中屏 overlay；移动全屏详情。
- Task 6 deterministic engine 与本地 Profile，区分数据未就绪、资料缺失、JD 歧义及边界不明；无模型调用。
- Gate → 逐字 evidence → context → Full JD；独立 Full Detail；真实官网投递链接。
- loading、空结果、错误/重试与 partial-source-failure 状态。

## Readiness 与真实数据

2026-09-29 preflight：8 jobs，3 ready、5 unprocessed。仅用既有 runner backfill 五条，5 success，0 DeepSeek calls，约 1503ms（逐行处理和写入耗时合计）。未改 extraction/qualification/source reliability 语义。最终 8 ready、0 unavailable，合计 5 gates。

资格依赖 Profile，不是岗位固定属性：

| 验收 Profile | Eligible | Check | Blocked | Excluded |
| --- | ---: | ---: | ---: | ---: |
| 未填写 | 5 | 3 | 0 | 0 |
| 在校 / 2027 / 本科 / 机械工程 | 5 | 0 | 3 | 0 |
| 在校 / 2027 / 博士 / 机械工程 | 7 | 0 | 1 | 0 |

## 验证记录

- 2026-09-30 当前代码：lint、typecheck、全量 17 files / 292 tests、production build 通过。
- 桌面/移动真实流程已完成：Onboarding → Radar → Search/Filter/Sort → Peek → Evidence/Context → Full Detail → vivo 官方投递链接 → 修改 Profile → 资格立即更新。
- 已打开 Radar 跨标签页实测 Check → Blocked → Eligible，修改期间 Radar 网络请求 0；偏好不触发阻断。
- 390/1100/1280/2560px 已测，无横向溢出；keyboard Enter/Escape、关闭焦点返回、面板键盘调整/持久化、mobile >=44px、input 16px、reduced motion 检查通过。
- NCSS 失败仅在浏览器 RSC 响应中模拟，不改 Supabase；8 条岗位仍可浏览。错误恢复使用单独 localhost 进程的不可用数据地址，Profile 仍可访问。
- 最新截图实际渲染，page errors 0；可复现流程在 tests/browser/。

## First-pass review 与已修复问题

已使用项目 anti-ui-slop 与 web-design-guidelines。修复了成熟面板库默认高度覆盖、Tailwind v4 Dialog 独立 translate 导致移动半屏偏移、既有全局 button 样式覆盖、重复缺失理由未注明字段，以及 Full Detail error boundary 的 client 声明。closed 详情额外防御 malformed gates。格式化后 server-only 断言改为不依赖单双引号。

本轮截图前不再重构 CSS 或探索新视觉。仍明显可改进、待用户视觉参考：

1. 桌面 Browse 行距和留白偏松，信息密度可再平衡。
2. 手机三列筛选文字拥挤，部分可见文本截短；需要定向调整排布。
3. Detail 标题、节间距和 Evidence 层级仍为基础实现，尚未做最终精修。
4. 列表与 Peek 的滚动衔接可优化，避免打开靠后岗位时选中行退到当前可见范围之外。

这些记录不构成 M0 最终视觉验收。等待截图反馈，保留当前实现，不加入 Saved/Hide/Seen/Compare/Account 或新 design system。
