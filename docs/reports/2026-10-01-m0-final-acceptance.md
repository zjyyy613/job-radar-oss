# Job Radar M0 Final Acceptance

日期：2026-10-01（Asia/Shanghai）。结论：**PASS**。Task 1–7 的 M0 Stop Rule 已满足；Brand Direction 与 Task 7 Visual Design 按用户验收冻结。没有进入 M1，没有更改冻结契约、资格语义、视觉或品牌资产。

## 验收依据与范围

重新阅读 Product Spec v1.0、Technical Architecture v0.1、M0 Implementation Plan、DESIGN、Task 2–6 报告、Task 7 baseline / refinement / implementation / high-impact 报告及 Brand Vectorization 报告。以用户当前授权覆盖历史文档中阶段性的“尚未进入下一任务”说明，不把历史计划未勾选项当作当前运行状态。

本轮生产代码未改。仅更新 README、补充可复现浏览器验收与本报告/截图。现有 Task 7 和品牌实现一并进入最终提交。没有重新抓取或提取，没有数据库写入或模型调用。

## 当前真实数据

只读核查时间约 15:02（Asia/Shanghai）。

| 来源 | source_records | jobs | 招聘状态 | 最新记录的 source run |
| --- | ---: | ---: | --- | --- |
| job-pro:tencent | 2 | 2 | 2 Open | success，9 月 28 日 09:39 |
| job-pro:xiaomi | 2 | 2 | 2 Open | success，9 月 28 日 09:39 |
| job-pro:vivo | 2 | 2 | 2 Open | success，9 月 28 日 09:39 |
| NCSS | 2 | 2 | 2 Unknown | success，9 月 28 日 10:00 |

合计 8 jobs / 8 source_records / 7 source_runs；Closed=0，全部 missing count=0。四个来源最新 run 都是 bounded `full_list=false`。这是已记录来源证据，不声称今天重新验证了各上游服务或所有岗位仍开放。

8/8 extraction 成功、input/attempt hash 与当前 raw_content_hash 一致、无 error。共 5 gates，5/5 非空 quote 逐字存在于指定 title/description/requirements。无跨公司误合并迹象，仍为八个独立 canonical jobs。

| 浏览器验收资料 | Eligible | Check | Blocked | Excluded |
| --- | ---: | ---: | ---: | ---: |
| 未填写 | 5 | 3 | 0 | 0 |
| 在校 / 2027 / 本科 / 机械工程 | 5 | 0 | 3 | 0 |
| 在校 / 2027 / 博士 / 机械工程 | 7 | 0 | 1 | 0 |

验收资料在隔离浏览器会话中填写，不是对用户本人资料的断言。可选资格为 null、偏好为空；修改偏好为不匹配值也不改变 hard qualification。

## M0 Stop Rule 与导航

Chrome + 本地 production build，真实数据库数据：Desktop 1440px 和 Mobile 390px 全流程通过：首次 Radar → Onboarding 四项 → 保存 → Search → 地点 Filter → Sort → Peek / Mobile Detail → Qualification → verbatim Evidence → Context → Full Detail → 官网投递 → Profile 编辑 → 立即重算 → reload / Back / Forward。

- 全程无登录；官网链接实际打开 vivo 公共招聘详情，未提交申请表。
- q/city/status/sort/job 的完整 round-trip 由离线测试覆盖；浏览器验证 search/city/sort/selected 刷新与 history，资格筛选实现与引擎复用通过测试。
- 默认 qualification-first 且不隐藏 Blocked；详情失效 ID 和 Full Detail 不存在 ID 均能恢复。
- Full Detail 返回保留 Radar 查询与选中项；关闭 Peek 焦点回到原岗位。
- desktop 可用键盘调整宽度并 reload 保留；1100/768 overlay、390 全屏详情、1280/2560 split 正确。
- 银行长标题、腾讯多地点、Blocked vivo、真实 evidence/context/full JD 无横向溢出。
- 浏览器响应压力场景另覆盖空库、长 Evidence 和 >20,000 字职责正文；明确为测试变换，不是上游事实，未写库且不用于最终真实截图。
- no-result search 可清除筛选；独立 localhost:3001 进程使用不可用数据地址验证 error/retry，同时 Profile 仍可访问。没有更改 `.env.local`。

## Local Profile

实际浏览器验证首次创建、optional null、编辑/reload、跨标签页同步、clear/cancel、清除后 reload 和其他应用 key 保留。损坏 JSON 不静默覆盖，禁用 storage 有可见错误；quota 写入失败保留草稿，恢复后可重试。

已打开 Radar 跨标签页经历 Check → Blocked → Eligible；更新期间 Radar 网络请求为 0。Profile 保存请求为 0，没有 DeepSeek 请求。

## 语义与来源故障

全量离线测试含原 Spike 24/24 truth table、preferred 永不 Block、closed 优先 Excluded、required fail/missing、ambiguous、OR、preference 隔离及 ready-zero-gates / stale / failed / unprocessed。

Source reliability 测试覆盖 timeout/403/5xx/crawler failure → Unknown 且不增加 missing；一次成功 full-list 缺失只加一次，连续两次才 Closed；明确 closed；NCSS 缺失无权关闭；来源隔离。真实数据没有人为插入 failed 或 Closed。

浏览器仅将 NCSS source-health 响应改为 failed，390/768/1100/1280/2560 均展示 partial availability，8 岗位仍可读、页面不整体失败。该 UI 模拟不运行状态归一化；后台状态和计数规则由正式 reliability/canonicalization 测试验证，二者不能混称一次真实 ingestion 故障。

## Quality / finish gate

| 检查 | 本轮结果 |
| --- | --- |
| lint | PASS，0 warnings |
| typecheck | PASS |
| 全量 tests | PASS，17 files / 292 tests，含 NCSS Python bridge |
| production build | PASS，Next.js 16.3.6 |
| Desktop / Mobile 完整流程 | PASS，pageerror=0 |
| 响应式及 partial source | PASS，390 / 768 / 1100 / 1280 / 2560 |
| 品牌布局 | PASS，320 / 390 / 768 / 1023 / 1600 |
| 空库 / 长文压力 / storage recovery | PASS |
| diff check | 项目实现 PASS；固定上游 Hallmark `component-cookbook.md:264` 有既有 EOF 空行提示，保留上游原文件，不作为产品阻断 |

使用项目 anti-ui-slop final finish gate：实际查看本轮四张真实截图、确认冻结的 row-based Browse/Inspect、证据阅读路径和主要状态；不以审计为由重开设计。

使用 web-design-guidelines final audit，已读取官方当前 [guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)。检查现有组件的 labels、原生按钮/链接、skip link、可见焦点、键盘 Enter/Escape、关闭焦点归位、移动目标 >=44px、输入16px、reduced-motion、长内容、状态文案与安全外链。关键实现：`app-shell.tsx`、`radar/detail-peek.tsx`、`radar/filter-bar.tsx`、`job/evidence-disclosure.tsx`、`profile-form.tsx`、`globals.css`。未发现 blocker/high-severity；不声称覆盖所有辅助技术或完成 accessibility 认证。本轮不使用 Hallmark，不运行 redesign/build。

## Brand / Security

三个最终 SVG 只含 svg/title/path，无字体、位图、外部引用、gradient/filter/shadow。复核已验收的16/20/24/32px 1×校样和浅底显示；本轮检查 Sidebar/header 不溢出、资源加载成功、favicon link/200/SVG MIME 正确。没有声称自动化观察了 Chrome 原生标签栏图标。

- 精确匹配本地配置的 Supabase secret / legacy service-role（若配置）/ DeepSeek key：代码、fixture、报告、验收日志及 `.next/static` 共419文件扫描，0命中；不输出密钥。
- 浏览器32个本地响应及请求 URL/header/body 检查，0密钥匹配；该浏览流程无外部 API 请求。官网申请跳转由独立完整流程检查。
- `.env.local` ignored 且未被 Git 跟踪；暂存区提交前再次核验。
- Supabase reader 与 query入口 `server-only`；显式列投影不返回 raw_payload、凭据或 source error body。DeepSeek/ingestion/extraction仍仅在scripts后台，不进入页面请求路径。
- 没有 Auth、用户表、浏览器service-role客户端或新权限策略。本轮未执行新的远端RLS advisor；既有迁移/权限测试通过，历史远端advisor记录见Task2–5，不冒充本轮新结果。

## Integrity / 修复

- 修正 README “未进入Task7 / 根路径Profile”过时说明，明确当前入口、后台运行边界及设计历史文档时态。
- 修正响应式验收脚本关闭详情后抢先聚焦下一行的竞争：等待详情卸载和原行焦点恢复后再测试键盘；不是产品缺陷。
- 补充 tablet、local profile failure/recovery、浏览器secret与长文/空库检查，未修改产品功能代码。
- 没有发现生产代码引用 `.verification`、设计探索图片、旧placeholder或debug harness；品牌仅引用最终SVG，公司logo独立。
- 没有M1 Saved/Hide/Seen/Compare/账号/评分等功能；未发现需要补实现的M0 TODO。历史阶段限制已在当前README/本报告交代，旧报告保留真实过程。
- 锁文件与固定依赖一并提交；Hallmark为之前获准安装的项目级历史研究Skill，无运行时依赖；其文件不属于生产bundle。

## 完成与后续界线

**M0 completed**：双来源家族、保守归一化与可靠性、受验证提取、Guest profile/资格引擎、真实Radar浏览到原文与官网投递、URL/响应式/本地恢复、最终品牌和视觉。

**M1 backlog（未实施）**：Saved、Hide + Undo、Seen/New、inline profile completion、后续移动/无障碍精修等；不把这些缺失列为M0阻断。

**Infrastructure follow-up**：当前无Git remote、未push/部署，GitHub Secrets与Actions待远端配置及运行。canonicalization/extraction为显式串行后台入口，不承诺来源workflow自动刷新整条jobs/gates链路。现有抓取是小样本、有预算的bounded run；完整列表关闭推断不能在没有完整快照时启用。初始本地`0001`与远端迁移历史版本须在未来`db push`前对齐。模型失败缓存/手动重试与CAS并发边界继续遵守Task5说明。

不存在阻断M0产品验收的已知问题；最终提交后停止，等待用户最终确认，不进入M1。

## 最终真实截图

- [Desktop Browse](assets/m0-final/desktop-browse.png)
- [Desktop Inspect](assets/m0-final/desktop-inspect.png)
- [Mobile Radar](assets/m0-final/mobile-radar.png)
- [Mobile Detail](assets/m0-final/mobile-detail.png)

补充保存mobile-filters与mobile-full-detail。Desktop1600×1000，Mobile390×844；8个真实jobs、2027本科机械工程验收Profile，5Eligible/3Blocked。
