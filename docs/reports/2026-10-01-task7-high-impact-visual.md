# Task 7 High-impact Visual Pass

日期：2026-10-01。仅对已验收 Task 7 做最后一轮限定视觉调整，未重设 IA，未生成图稿，未进入 M1，未 Freeze 或提交最终冻结。

## 修改文件

- `src/app/globals.css`：桌面 logo 与 fallback 尺寸、JobRow 轨道、搜索/筛选工具区、详情身份组、中性资格摘要与证据注脚层级。
- `src/components/app-shell.tsx`：仅增加品牌 placeholder 注释，原图标及导航不变；预留现有 26px 品牌槽位，等待独立 Brand Mark Mini Sprint。
- `public/company-marks/README.md`：同步桌面 28px / 34px 容器、移动 18px / 24px 的说明。
- 本报告及 `assets/task7-high-impact/` 最终截图。

未修改领域、qualification/readiness、字段、控件集合、Supabase、Profile、路由或依赖。

## 调整结果

Desktop logo 实测 28px 图形 / 34px 中性容器，原始品牌色与首字符 fallback 保留；位于岗位身份组左侧，与标题和公司共享定位，标题仍 15px/600。Mobile 保留小图标。

列表宽度 >=650px 采用身份 / 地点与收录时间 / 既有资格信号三条位置轨道；>=1050px 时身份区上限 430px、地点区上限 330px，28px 间距，不再让中部两区无限拉开。普通行实测 90px；长银行标题和腾讯多地点自然换行。没有列头、checkbox、收藏或菜单。没有资格信号的行仍保留安静区域，不用无意义内容填满。

Search 与 Filters 由一层轻中性工具区收拢，搜索占顶部完整输入行；筛选恢复浅 surface、细边界、hover 与 pointer，保留真实搜索/地点/资格/排序。Mobile 不改交互结构。

Detail 身份组加强公司字重与小 logo，资格摘要采用中性浅底而非警告色块；移除普通 section 的重复上边线，以标题和间距分组。Gate 标题加重；Evidence/Context 在同一局部细线与缩进内阅读，不增 tabs 或状态药丸。现有证据原文、原因和 gate 数据未动。

## 真实数据

截图仍使用真实 8 条 canonical jobs。独立浏览器测试会话通过现有 onboarding 保存与上一轮一致的 Profile：在校、2027、本科、机械工程；可选 null，偏好空。逐项核对 snapshot 的 job id/title/company；资格仍 5 Eligible / 3 Blocked / 0 Check / 0 Excluded。选中真实 vivo“Agent 算法工程师- 27届蓝极星”，保持博士学历要求导致的 Blocked；quote 仍为“2027届获得博士学历”。未修改用户其他会话 Profile，未写数据库或调用模型。

## 验证

- lint：通过，0 warnings。
- typecheck：通过。
- tests：17 files / 292 tests 通过。
- build：通过；对比度修正后再次全部通过。
- 桌面/移动 browser acceptance：通过。搜索、筛选、URL 历史与刷新、Peek/Full Detail、证据/context、官网链接、Profile 重算、空结果及返回焦点保持。测试会话 Profile 保存请求数 0。
- responsive：390 / 1100 / 1280 / 2560 键盘、真实长标题、部分来源失败检查通过，无横向溢出。NCSS failed 仅在浏览器响应模拟，不更改真实 source 状态。
- 附加 320 / 375 / 768：无横向溢出。logo 尺寸实测正确；图标请求失败的 V fallback 验证通过。
- 最终截图脚本再次通过真实数据/Profile/资格核对，pageerror 为 0。
- `git diff --check`：通过，仅已有换行符提示。

## anti-ui-slop finish gate / web-design-guidelines audit

沿用已读取的 polish、craft、audit、Finish 规则，并重新取得官方 Web Interface Guidelines。实际观察 Desktop Browse、Inspect、Mobile Radar、Mobile Detail，按本轮限定目标核对层级、扫描位置、surface、长文本、图标和必要状态。

发现并修复：新中性 surface 上原 secondary 小文字对比度约 4.47:1，低于 4.5:1。将工具区标签、资格摘要辅助文字局部改为现有 #53534e（与 #F1F1EE 约 6.8:1），未更改 semantic colors；Blocked 约 5.09:1、Check 约 4.76:1。修复后重跑检查、重拍并观察详情截图。

- `src/app/globals.css:1608`：PASS，桌面专用尺寸与 container query 不改变 DOM 读取顺序；移动交互保留；select 有可识别边界及焦点；无阴影卡片或新动画。
- `src/app/globals.css:1767`：PASS，新 surface 小文字对比度已修复；状态继续由文本表达。
- `src/components/app-shell.tsx:15`：PASS，仅注释明确 placeholder，没有更换品牌图标或伪称最终资产。

范围内无未解决的阻断问题；未宣称全站 accessibility 认证。错误恢复与 loading 逻辑未变，本轮未重新启动故障服务测试，上一轮已验证的结果不计作本轮新跑。

## 截图与限制

- [Desktop Browse](assets/task7-high-impact/desktop-browse.png)
- [Desktop Inspect](assets/task7-high-impact/desktop-inspect.png)
- [Mobile Radar](assets/task7-high-impact/mobile-radar.png)
- [Mobile Detail](assets/task7-high-impact/mobile-detail.png)

补充保存 mobile-filters / mobile-full-detail。Desktop 1600×1000，Mobile 390×844。Detail 实测约 527px，保留已验收的调宽/上下限。

现有官方 favicon 在放大后个别细节略软，未擅自换资产或重绘；品牌左上角明确仍是 placeholder。视觉完成度最终由用户验收，当前停在此处，不自动 Freeze。
