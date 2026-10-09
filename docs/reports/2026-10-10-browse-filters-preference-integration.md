# Product Improvement v1 · Task 2 — Browse Filters & Preference Integration

日期：2026-10-10。基于本地 Task 1 `be677a8`；仅本地实现、生产模式验收，不 push、不部署。

## 实现与边界

- 公司筛选来自实际 `CanonicalJob.company`，按完整名称精确匹配、去重；不推断集团、子公司或别名。当前 13 家。未知 URL / 偏好公司保留为可见选项并显示空结果，不静默取消条件。
- URL 新增 `company` 和 `role`。Search / City / Company / Qualification / Role 取交集，之后沿用原排序。每个岗位只遍历、输出一次。
- “应用求职偏好”仅在保存了偏好时出现。先展示已保存选项，由用户选择单个地点、公司和岗位关键词，再确认应用；打开弹窗及选择草稿不会改变结果。
- 应用替换浏览的地点、公司、标题关键词，保留已有 Search / Qualification / Sort。偏好城市复用 Task 1 的 `locationOptions` 与 `resolveCityFilter`，复合地点拆成单选项；公司不改名；岗位仅作标题不区分大小写的子串匹配，不声称语义或精准匹配。
- 已应用条件写入 URL，修改 Profile 不会偷偷替换当前浏览条件。标题关键词有独立取消入口；“清除全部筛选”恢复全部岗位（保留排序与当前详情上下文）。无结果页清除按钮也清除新增条件。
- 原始 location、详情、Qualification Engine、Evidence、Reliability、抓取与数据库均未修改。偏好不传入 Qualification Engine，不会产生 Blocked。

## 城市选择器取舍

原生下拉实现简单、系统键盘行为稳定，但当前 54 个城市／地区加 2 个保留原值，需要较长滚动。采用现有 Radix Dialog 中的轻量搜索 + 单选按钮列表：输入可缩小候选，支持既有城市别名；不增加依赖，不引入地图、层级或多选。

打开时聚焦标题，避免移动端自动弹出键盘；Tab 进入搜索、Enter 选择、Escape 取消，关闭后焦点返回入口。搜索无匹配有明确提示，“全部地点”始终可选。沿用现有移动端折叠筛选区；仅增加公司控件和偏好入口。

## 真实数据验收

本地 `next build` + `next start`，使用 Supabase 只读真实数据：411 jobs、13 companies、411 jobs 有来源 metadata，无数据读取 warnings。没有触发 ingestion / extraction 或数据库写入。

隔离浏览器 Profile：在校 / 2027 / 本科 / 机械；偏好城市北京、上海；岗位运营、工程师；公司美团、腾讯及未知公司（用于边界测试）。不修改用户现有浏览器资料。

| 条件 | 实际岗位数 |
|---|---:|
| 无筛选 | 411 |
| 美团 | 53 |
| 北京 + 美团 + 标题含运营 | 6 |
| 上述条件 + 搜索实习 + Check + 最近收录 | 1 |
| 未知公司 | 0 |
| 旧城市别名北京市 + 腾讯 | 2 |

1440px Desktop、1024px medium、390px Mobile 对以上 6 组逐一核对岗位 ID 和顺序，验证无重复。确认前 411 条不变，确认后 6 条；清除恢复 411。

覆盖 URL direct link / reload、Back / Forward、Detail Peek → Full Detail → 返回 Radar、未知公司空结果、无偏好、城市别名搜索、无匹配城市、Enter / Tab / Escape 与焦点返回。页面无横向溢出，浏览器 pageerror 为 0。

## Quality 与自审

- lint：PASS。
- typecheck：PASS。
- 全量 tests：24 files / 395 tests PASS（新增 8 个测试）。
- production build：PASS。
- `git diff --check`：PASS。
- `package.json` / lockfile 不变，无新增运行时依赖。
- anti-ui-slop finish gate：核对真实桌面／移动截图，保持既有行列表、工具区与 Detail 阅读结构，无新视觉体系。
- web-design-guidelines audit：使用真实 button / label / select、Dialog 的 focus trap 与 Escape、可见焦点、44px 移动点击目标、16px 弹窗输入、明确空状态、URL 驱动的导航状态。
- 自审修复：Radix `asChild` 改写 `data-slot` 后，原全局 button 样式影响新弹窗入口/取消按钮；采用限定于本次组件的样式修正。城市选项不继承全局深色按钮；弹窗初始焦点改为标题，确保 Tab 可预测。
- URL 单测按恢复后的状态比较，避免将等价中文 URL 编码误判为失败。

## 修改文件

- `src/lib/radar/url-state.ts`：company / role URL 状态。
- `src/lib/radar/presentation.ts`：公司及标题关键词浏览筛选。
- `src/lib/radar/browse-filters.ts`：公司选项、偏好转换、城市搜索、统一清除。
- `src/components/radar/radar-client.tsx`：接入本地偏好与公司选项。
- `src/components/radar/filter-bar.tsx`：公司控件与显式应用／清除。
- `src/components/radar/browse-dialogs.tsx`：城市单选与偏好确认弹窗。
- `src/app/globals.css`：上述组件局部样式。
- `tests/radar/browse-filters.test.ts`、`tests/radar/radar.test.ts`：组合与边界回归。

## 截图

- [Desktop Browse](assets/browse-filters-v1/desktop-browse.png)
- [Mobile Browse](assets/browse-filters-v1/mobile-browse.png)
- [Desktop 城市搜索](assets/browse-filters-v1/desktop-city-search.png)
- [Mobile 城市搜索](assets/browse-filters-v1/mobile-city-search.png)
- [Desktop 偏好确认](assets/browse-filters-v1/desktop-preferences.png)
- [Mobile 偏好确认](assets/browse-filters-v1/mobile-preferences.png)

## 结论与限制

PASS。公司仅精确匹配当前名称；岗位偏好仅标题关键词；每次偏好应用每类最多选一项，城市继续单选。不做别名猜测或多偏好 OR 扩展。Production 保持原版本；本地提交后等待统一验收。
