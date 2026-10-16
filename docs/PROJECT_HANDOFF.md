# Job Radar — 三方协作交接文件

> 本文件只记录**协作状态**（谁在做什么、做到哪、下一步），不替代任何业务规则与技术规范。
> 业务与冻结规则以 [Product Spec v1.0](specs/job-radar-product-spec-v1.0.md)、[Technical Architecture v0.1](architecture/job-radar-technical-architecture-v0.1.md)、[DESIGN.md](../DESIGN.md)、[README.md](../README.md) 为准，本文不复制其内容。
> 维护约定：本文件由 **DSH 作为主要维护者**更新，ChatGPT 负责项目协调与任务状态核对，Codex 读取本文件的交接信息；按任务分配或完成节点更新，避免双方同时编辑，且每次更新都要附实际证据。

- 文件版本：v11
- 最后更新：2026-10-16
- 最后更新者：DSH
- 更新节点：PRODUCT-04A（真实来源扩量试点，只读）完成

## 1. 当前稳定基线

| 项 | 值 | 核实方式（2026-10-15） |
| --- | --- | --- |
| 项目 | Job Radar | — |
| 状态 | Product Improvement v1 Released / Frozen | User 确认 |
| 生产数据快照（最新） | 429 jobs / 13 公司；网易 64、美团 59；腾讯/小米/vivo 各 2；extraction ready 363 / failed 66；`published_at` 2；`internship_type` 0；`recruitment_batch` 0；427 条有职责+要求+申请链接 | **由 ChatGPT 经 Supabase 只读查询确认**（2026-10-15）；DSH 未直接连库 |
| 生产数据规模（User 通报） | 约 472 jobs / 13 公司（2026-10-16） | **User 提供，DSH 未连库核实**；本文件可核实的最新口径仍为上一行的 429（2026-10-15）。两个数字不可混用 |
| GitHub 生产分支 | `task-1-m0-contracts` | `git ls-remote --symref origin HEAD` |
| 生产分支 commit（GitHub） | `18e042297f2b572f160bedad777e5edb5777810d` | 同一次 `ls-remote`，与 DSH 本地基线一致 |
| 已部署版本（Vercel Production） | `18e042297f2b572f160bedad777e5edb5777810d` | **由 ChatGPT 通过 Vercel 部署接口核实**；DSH 未独立验证 |
| DSH 本地分支 | `work/dsh`（纯本地，无 upstream，未推送；各任务具体 commit 见第 3 节） | `git rev-parse` |
| 正式网站 | (production deployment not published) | 实测 HTTP 200；`/radar` 已渲染 Radar / Saved / Profile |

**三个版本必须区分**

1. **已部署版本** = `18e0422…`（Vercel 生产；由 ChatGPT 经 Vercel 部署接口核实）。
2. **GitHub 生产分支** = `task-1-m0-contracts` @ `18e0422…`，与已部署版本一致。
3. **DSH 本地 HEAD** = `work/dsh` @ `3016bed…`，是在生产提交之上的**文档提交**。**本地文档提交不等于生产发布**：未 push、未部署、未合并至生产分支。

**核实边界（同日期）**

- 远端只有 `task-1-m0-contracts` 一个分支，其 HEAD 符号引用指向它；该 SHA 与本地 `task-1-m0-contracts` 一致，工作区 clean，无 tag。
- 已部署版本的 SHA 记录自 **ChatGPT 通过 Vercel 部署接口的核实**。**DSH 未独立验证该 SHA**，仅独立核实了站点可访问（HTTP 200）且线上包含 `/saved` 路由。
- `task-1-m0-contracts` 已关联 Vercel Production 自动部署（见 [2026-10-09 地点归一报告](reports/2026-10-09-location-normalization.md)）。因此**未经明确授权，不向该分支提交或 push**。

## 2. 协作角色

| 角色 | 职责 |
| --- | --- |
| User | 方向、优先级、**任务分配**与最终批准；唯一授权来源。 |
| ChatGPT | 项目协调、任务拆解、验收建议、跨 AI 进度核对，并负责对本文件任务状态的核对。不假定能自动读取未同步的本地修改。 |
| Codex | 按明确授权执行工程任务；从本文件读取交接信息。 |
| DSH | 按明确授权执行独立开发、分析、测试与文档任务；**本文件的主要维护者**。 |

角色描述不构成永久的模型能力等级判断，具体任务可重新分配。

## 3. 当前任务记录

状态取值：`Planned / In Progress / Review / Completed / Blocked`

| Task ID | Task | Owner | Status | Branch/Commit | Next Action |
| --- | --- | --- | --- | --- | --- |
| SETUP-01 | 建立共享项目交接文件 | DSH | Completed | `work/dsh` @ `3016bed` | 无（据 User 通报已以 Git fast-forward 同步至 Codex 工作区）；未 push、未部署 |
| SETUP-02 | 最小文档状态同步（交接文件 / README / AGENTS.md / DESIGN.md） | DSH | Completed | `work/dsh` @ `40c58e7` | 无 |
| DATA-01 | 岗位覆盖与数据质量评估（只读分析） | DSH | Completed | 只读，无代码变更 | 方向已通过 User 与 ChatGPT 审查；结果并入 DATA-02 交付报告 |
| DATA-02 | 现有官方来源小规模扩量验证（`tencent / intern` 有界 dry-run） | DSH | Completed | `work/dsh` @ `d03b736` | 已通过阶段验收 |
| DATA-03 | 双来源有限深度验证（`tencent + vivo / intern`，各 20 条） | DSH | Completed | `work/dsh` @ `a0320e6` | 等待下一阶段扩容决策 |
| ENGINEERING-01 | 提取失败排查 | — | — | **仓库内无记录** | 需 User / ChatGPT 提供其排查结论；DSH 未据此改动 |
| ENGINEERING-02 | 提取诊断与 partial 运行状态提示修复 | DSH | Completed | `work/dsh`（本轮工程提交） | 已通过 targeted / full / lint / typecheck / build |
| PRODUCT-01 | 竞品岗位发现机制与职位分类方案（产品研究，无代码变更） | DSH | Completed | 只读研究 | 结论已交付；D1–D3 三项决策待 User 确认，未落盘为仓库文件 |
| PRODUCT-02 | 省份分组地点选择器（Radix 地点弹层内的一级→二级导航） | DSH | Completed | `work/dsh` @ `94ed77f` | 已发布；证据见 `province-grouping-v1`（手风琴版，已被 02.1 取代） |
| PRODUCT-02.1 | 地点归类修订 + 多列展开式选择器（桌面双栏 / 手机分步）+ 发布前文案微修复 | DSH | Completed | `work/dsh` @ `9453ad5` | **真实 `/radar` 页面验收 PASS（88/88，472 条真实岗位）**；已通过 444 项测试 / lint / typecheck / build；文案 P2 已修复；待发布 |
| PRODUCT-03A | 472 条真实岗位分类验证（离线分析，无产品代码变更） | DSH | Completed | 分析交付（脚本在 gitignore 目录） | 结论：11 个一级 / 37 个二级；未分类 0.4%；发现 7 类真实误分类并修正。统计不一致经核对为**报告抄录错误**，分类器自洽 |
| PRODUCT-03B | 岗位大类 → 小类导航（分类模块 + `cat`/`sub` 筛选 + 两级选择器） | DSH | Completed | `work/dsh`（本轮产品提交） | 已通过 531 项测试 / lint / typecheck / build + 154 项组件级浏览器验收（桌面+手机）+ 地点选择器回归 85/85；**真实 `/radar` 发布前验收 PASS（141/141，472 条真实岗位，无 P0/P1）**；证据见 [product-03-job-category.md](reports/product-03-job-category.md)；待发布 |
| PRODUCT-03B-fix | 发布前交互修复：一级方向只浏览、不改变筛选（「全部X岗位」/二级为确认动作） | DSH | Completed | `work/dsh`（本轮提交） | 最小改动：`category-choice.tsx` 去掉一级点击即应用 + 明确「全部{方向}岗位」入口；组件级交互验收 **184/184**（新增 30 项针对浏览/取消/确认的回归）；定向测试 188 通过 / lint / typecheck / build 通过 |
| PRODUCT-04A | 真实岗位来源扩量试点（只读 dry-run + 扩量阻断审查） | DSH | Completed | `work/dsh`（本轮提交） | **只读**：小米 intern 50/50 详情+准入、京东 intern 100/100、美团 99/100；上游总量远超库内（小米 564 vs 2）。发现并**最小修复**全量 batch CLI 在 jobs>500 时失败（472→28 余量）；登记 canonicalization 1000 上限、refresh scope 硬编码 intern、page-size 非 workflow 输入、分类器对物流/物业/医疗标题覆盖不足。首批建议：小米 intern 位次 1–40（≈6 次模型调用）。**04B 预检（只读）已完成**：按生产真实分页参数 `--limit 2 --max-pages 20 --max-jobs 40` 复跑 dry-run → 20 页 / 40 条 / 详情 40/40 / **准入 40/40** / 0 失败 / 89.7s，且与 04A 样本**位次 1–40、顺序完全一致**；据此修正两处计划缺陷：① 生产命令缺 `max_jobs=40` 只会抓 2 条（已由代码路径与 dry-run 双重确认）；② **不能按 `source+fetched_at` 回退**（upsert 为 merge-duplicates，会刷新既有记录的 fetched_at → 误删真实数据），改为按写入前 ID 差集核对/精确删除；并明确 **PARTIAL 退出码为 0**，不得只凭 Actions 绿色判成功。报告见 [product-04a](reports/product-04a-source-expansion-pilot.md)；**待正式写入授权** |
| — | 当前无进行中的产品开发任务 | — | — | — | 等待 User 分配 |

本表只登记**已授权且有实际证据**的任务；未分配的工作不预填 Owner、不虚构进度。

## 4. 最近完成事项

| 事项 | 状态 | 关键结果 / 证据 |
| --- | --- | --- |
| Product Improvement v1 Task 1–4 | Completed（已验收，已随生产发布） | 地点归一与城市筛选；组合筛选与偏好应用；最小 Saved；时间与招聘状态表达。见 [2026-10-09](reports/2026-10-09-location-normalization.md)、[2026-10-10 筛选/偏好](reports/2026-10-10-browse-filters-preference-integration.md)、[2026-10-10 Saved](reports/2026-10-10-minimal-saved-jobs.md)、[2026-10-15 时间与状态](reports/2026-10-15-freshness-status-clarity.md)。 |
| Final Integration Review | Completed | User 确认；DSH 未复核其明细。 |
| Production Release | Released | 已部署版本 `18e0422…`（ChatGPT 经 Vercel 部署接口核实）；站点实测 HTTP 200。 |
| DSH worktree 接入 | Completed | `E:\job-radar-dsh` 建立于 `work/dsh`；只读接入确认已通过。 |
| SETUP-01 交接文件 | Completed | [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) 建立；commit `3016bed`（本地）。 |
| SETUP-02 文档状态同步 | Completed | 修正 README 过期表述；AGENTS.md / DESIGN.md 更新 Skills 信息；本文件基线区分三个版本。 |
| DATA-01 数据覆盖评估 | Completed | 只读分析：8 家受调度源占 98.0%；腾讯/小米/vivo 各 2 条；受调度源上游覆盖率约 11.4%；建筑/法学方向样本为 0；`published_at` 2/429。见 [数据覆盖评估](reports/2026-10-15-data-coverage-assessment.md)。 |
| DATA-02 腾讯 intern 扩量验证 | Completed | 实测 2 页 / 10 候选 / 详情 10-10 / 准入 10-10、12.8s、0 失败、停止条件 `max_jobs`、10-10 官方 `join.qq.com` 申请链接；与库内 2 条腾讯 campus 记录 ID 无交集（**库内存在性未核实**）。 |
| DATA-03 双来源深度验证 | Completed | 腾讯与 vivo 各 20 条（4 页 × 5）：详情 **40/40**、准入 **40/40**、0 失败、墙钟 57.9s；40 条与已知在库 4 条（Task 2 campus）ID 无交集（**待数据库核验**）；方向覆盖扩至金融/税务、咨询/项目管理、设计、行政、机器人。 |
| ENGINEERING-02 提取诊断与 partial 提示 | Completed | 提取失败新增**内容无关**的结构化诊断（stage / 固定 reason code / 字段路径 / 索引），**对外仍为 `invalid_extraction`**，未放宽任何 Gate、Evidence、Qualification 校验；PARTIAL 显式写入 Step Summary 并发出 Actions warning，**退出码策略不变**。新增 23 项回归测试；全量 27 文件 / 434 项通过，lint、typecheck、build 全绿。 |
| PRODUCT-01 竞品研究与职位分类方案 | Completed | 三家竞品实地调研（BOSS 三层树 / 智联职类 3 级 + 专业独立轴 / 实习僧两级词表），逐条标注「直接验证 / 仅有搜索摘要 / 未验证-需登录」；在 219 条真实标题语料上实测 4 版规则（朴素关键词优先 4/23 错 → 混合规则 23/23、未分类 2.3%）；推荐 8 一级 + 28 二级 + 数据驱动渲染阈值。**无代码变更、未落盘为仓库文件**。 |
| PRODUCT-02 省份分组地点选择器 | Completed | `CityChoice` 内实现一级（省份/直辖市/港澳/境外/其他）→ 二级（城市）导航；复用既有 `regions` 单一数据源，未新增地区数据；只在数据中存在的 56 个地点上分组（31 组）；搜索不依赖展开。无 DB 字段、无 Gate/Evidence/Qualification 改动。证据见 [province-grouping-v1](reports/assets/province-grouping-v1/results.json)（68/68 通过；手风琴版，已被 02.1 取代）。 |
| PRODUCT-02.1 地点归类与选择器修订 | Completed | ①**展示层归类修复**（不改归一化/匹配）：`浙江`→浙江省并标注「未注明城市」、`海南省-澄迈县`→海南省（保留原始地名）、`中国香港`→香港特别行政区；矛盾组合（如 `广东省-北京市`）与无法归属值才留在「其他地点」。②**交互改为多列展开式**：桌面宽弹层「省份 4 列索引 + 相邻城市面板」，桌面 31 个省份**无需滚动全部可见**；手机改为「省份网格 → 城市」分步（避免嵌套长列表）。搜索、全部地点、已选显示、键盘与焦点恢复全部保留。证据见 [location-picker-v2](reports/assets/location-picker-v2/results.json)（85/85 通过）。 |
| PRODUCT-02.1 真实页面验收 + 文案微修复 | Completed | **真实 `/radar` 页面验收 PASS：88/88**（由 DSH 在主工作区 `E:\job-radar` 本地构建后执行，桌面 1440×900 + 手机 390×844）。真实数据 **472 条岗位 / 30 个地点分桶**；`广州` 44、`浙江` 1、`海南省-澄迈县` 1、`中国香港` 1；组合筛选 24；深链、返回、清除筛选、详情预览均正常。**「其他地点」已消失**（生产数据不再有无法归属值）。关键回归证据：`香港`=3 与 `中国香港`=1 **未被合并** → 匹配范围未扩大。验收发现的唯一 P2 文案（把省级/县级原始地点称作「具体城市」）已按 User 指定文本修复；未改动归类/结构/URL/筛选/资格。 |
| PRODUCT-03 岗位类别导航 | Completed | **分类模块**：`src/lib/radar/job-category.ts`（纯函数、无网络/模型/DB、版本号 `job-category-v1`），确定性规则表移植自 PRODUCT-03A 已验证脚本；职能词优先于领域词、含否决词与 `(?<!机器)人事` 碰撞守卫、规则不含任何公司名。**11 个一级 / 37 个二级**，主类别唯一（合计 = 472 且逐级自洽），`其他>未分类` 与 `其他>非岗位公告` 保留在默认列表。**UI**：新增「岗位类别」两级选择器（桌面索引+小类面板、手机分步+返回），复用 PRODUCT-02.1 的共享弹层 CSS；**点击一级只浏览不改筛选**，「全部X岗位」应用一级（清空二级）、点具体二级应用一级+二级，两者都在确认后关闭弹层；仅浏览后取消/Escape 时筛选、URL 与列表完全不变。**URL**：新增独立 `cat`/`sub`（稳定 id，不改 `role` 语义），与 q/city/company/status/sort 组合，前进后退/预览/详情返回保留状态；未知或父子不一致的链接有明确提示与「清除类别」，默认列表不丢岗位。**计数**：实时由其他筛选条件下的结果计算，展示数 = 实际结果数，不写死快照。**暂定分类**：30 条标题无法确定职能的岗位保留暂定类别并标注「岗位类别待核实」（与资格的「需要确认」严格区分）。证据见 [product-03-job-category.md](reports/product-03-job-category.md)、[job-category-v1](reports/assets/job-category-v1/results.json)（184/184，组件级）。 |

只列关键结果，不复制详细历史；完整过程见 [reports/](reports/)。

## 5. 待处理事项（Backlog / 待确认，均未获开发授权）

**A. 已知非阻断问题**

- extraction 未就绪岗位：66 条失败保持 `Check` 待专项审计；不自动重试（Phase 1B 时为 63 条）。
- **扩容前的两个硬上限**：提取单批 `jobs.length > 500` 直接抛错（当前 429，**余量仅 71**，`scripts/ingest/batch-gate-extraction.ts:22`）；canonicalization 快照 `source_records ≤ 1000` / `source_runs ≤ 10000`（当前 43%，`supabase/migrations/20260928122238_canonicalization_reliability.sql:22-24`）。
- `published_at` 仅 2/429 且两条均属 NCSS；根因已定位：腾讯 detail 载荷无 `post_date`；vivo 有 `post_date` 但**无时区**，被 `timestamp()` 的正则拒绝（`scripts/ingest/job-pro-adapter.ts:88`）。要让 vivo 贡献发布时间须改变时间解析策略。
- `internship_type` / `recruitment_batch` 在 job-pro adapter 中**硬编码为 null**（`job-pro-adapter.ts:80-82`），上游 `recruit_label` / `project` 未采纳，故全库 0 条；上游实际提供该字段。
- 腾讯 / 小米 / vivo 不在 `.github/workflows/refresh.yml` 默认调度源内，现有调度下长期停留 2 条/家。
- 迁移历史 debt：本地 `0001_job_radar_m0.sql` ↔ 远端 `20260928013502_job_radar_m0`；禁止重复执行初始 DDL，未做 history repair。
- 真实库无 `Closed` 样本，且所有 run 均为 `full_list=false`，**不得据此推断任何 Closed**。
- NCSS 来源无详情与申请链接（`description`/`requirements`/`apply_url`/`deadline` 恒为 null）。
- 提取失败的**详细诊断不入库**：`write_gate_extraction` RPC 对失败固定写 `extraction_error='extraction_failed'`（`supabase/migrations/20260928175131_gate_extraction.sql:100-101`），故 ENGINEERING-02 的诊断只存在于运行产物（stdout / checkpoint / summary.json）。要按原因从数据库筛选失败岗位，需另行动迁移决策。

**B. 后续产品候选方向（未授权，需 User 决策）**

- 正式扩容决策（每源 20–60 条起）：DATA-02 与 DATA-03 均判定「值得继续」；20–60 条本身安全，但需先决定每日 refresh 额度与上述两个硬上限的处理方式，待 User 决策。
- 定向补跑（3 个指定 ID + 内容哈希）：现有 `batch` 只能跑全量快照、单条 runner 无 checkpoint 也无调用预算，且**没有**「调用模型前校验当前 content hash 是否等于指定 hash」的步骤。最小能力应是 ID 作用域 + 哈希前置校验 + 复用现有 checkpoint 与 CAS 写入；**本轮未开发**。
- M1 其余能力：Hide + Undo、Seen/New、inline profile completion、Compare、账号同步。
- 来源侧：NCSS 扩页、新来源接入（ByteDance / Xiaomi 曾 429，Horizon、NIO 等 Later 项）；实习僧因上游协议限制已 Drop。
- 更长期：JD Lens。

**C. 环境与文档维护事项**

- DSH worktree 已安装 `node_modules`（ENGINEERING-02 经授权执行一次 `npm ci`，未改依赖版本），lint / typecheck / test / build 均可运行；仍缺 `.env.local`，故任何需要真实数据库或模型的命令不可运行。
- **ENGINEERING-01 的排查结果在仓库内不存在**（全仓库检索无该文档）；DSH 的 ENGINEERING-02 基于本轮自行定位的失败路径实现，未引用其结论。
- **`/radar` 无法在本 worktree 做真实数据验收**：页面经 server-only 读取 Supabase，缺 `.env.local` 时（`src/lib/data/supabase-server.ts:19`）抛出配置错误。因此 PRODUCT-02、PRODUCT-02.1 与 **PRODUCT-03B** 的浏览器验收都用**临时 harness 路由**驱动真实组件（PRODUCT-03B 用的是真实 `RadarClient` + 真实 472 条标题），交付前均已删除该路由。可复跑脚本：`tests/browser/province_grouping.py`（地点）与 `tests/browser/job-category.py`（岗位类别），在有凭据的工作区或 harness 上用 `CITY_BASE_URL` 指向目标页面。
- **PRODUCT-03B 的浏览器验收是组件级，不是真实页面端到端**：harness 中岗位/公司/标题真实（来自 2026-10-16 快照），但 id 由 `snapshot_row` 派生、地点按公司合成、`gates` 为空。因此分类筛选、计数一致性、零结果、URL 与交互已验收；**真实数据下的地点/资格维度来自 PRODUCT-02.1 的真实页面验收**，两者不可互相替代。
- **PRODUCT-03A/03B 的分析资产不入库**：`Job_Radar_PRODUCT03_472_titles_2026-10-16.json`（仓库根，未提交）与 `.verification/product03/`（已被 gitignore，含分类脚本、审计、TS↔Python 全量比对）都不在版本控制内。入库的是**内嵌金标测试** `tests/radar/job-category.test.ts`（81 例真实标题）与 `tests/radar/radar.test.ts` 的计数一致性用例。**全量 472 条不变式检查目前不在 CI 内**。
- **验收产物目录**：`docs/reports/assets/province-grouping-v1`（PRODUCT-02 手风琴版，历史）、`docs/reports/assets/location-picker-v2`（PRODUCT-02.1 多列/分步版）、`docs/reports/assets/job-category-v1`（PRODUCT-03B 岗位类别）。各自对应其 commit。
- **真实 `/radar` 数据验收已在主工作区完成**（PRODUCT-02.1）：由 DSH 在 `E:\job-radar` 用其既有 `.env.local` 本地 `npm run build` + `npm start -p 3322` 后，用 Playwright 对真实页面执行 **88 项检查全部通过**（真实 472 条岗位）。**该验收脚本未入库**（按本轮"不创建 commit"之外的边界，脚本与截图放在系统临时目录，两个工作区均未留下文件）；如需长期复跑，可把 `tests/browser/province_grouping.py` 的 `CITY_BASE_URL` 指向真实 `/radar`。注意：真实页面验收**必须在有 `.env.local` 的工作区**进行（`E:\job-radar`），`E:\job-radar-dsh` 缺该文件。
- **删除/新增 `src/app` 路由后必须清 `.next`**：`.next/dev/types/validator.ts` 会残留已删除路由的类型引用，导致 `typecheck` / `build` 报 `TS2307`（本轮已实际踩到并通过删除 `.next` 解决）。
- Git 全局配置 `http.proxy = http://127.0.0.1:7890` 当前不可用，`fetch/push` 会失败；直连 443 正常。未修改该配置。
- README 与 AGENTS.md / DESIGN.md 中「本轮只做 Pre-Task7」「M0→M1 backlog 未实施」等**历史阶段文字按 User 决定保留**，不代表当前状态；当前状态以第 1 节为准。
- 以上各项（除 DSH worktree 依赖准备外）均需单独授权后处理。

## 6. 协作规则

1. 同一个开发任务只有一个执行 Owner。
2. 两个 AI 不同时修改同一个任务范围；发现冲突先指出并等待重新分配，不做竞争性修改。
3. 每次工作前先检查：Git 状态（分支 / HEAD / 工作区）、当前任务记录、相关冻结规则。
4. 本地 worktree 不会自动同步未合并改动；不得假定他人能看到本地未提交内容。
5. 任务提交时说明：修改文件、测试结果、commit、已知风险。
6. 未经 User 授权：不 push、不部署、不写入生产数据库、不修改生产环境变量与自动刷新流水线。
7. 生产部署与历史完成状态**不等于**当前任务授权。
8. 本文件由 **DSH 作为主要维护者**按任务分配或完成节点更新，ChatGPT 负责协调与任务状态核对，Codex 读取交接信息；避免双方同时编辑。
9. 每次状态更新必须有实际证据（命令输出、报告、commit），不得仅依据模型推测；转述他人核实结果时必须注明核实方。
10. 不擅自修改已冻结的 Qualification、Evidence、Reliability 语义。
