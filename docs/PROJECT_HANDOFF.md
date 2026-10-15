# Job Radar — 三方协作交接文件

> 本文件只记录**协作状态**（谁在做什么、做到哪、下一步），不替代任何业务规则与技术规范。
> 业务与冻结规则以 [Product Spec v1.0](specs/job-radar-product-spec-v1.0.md)、[Technical Architecture v0.1](architecture/job-radar-technical-architecture-v0.1.md)、[DESIGN.md](../DESIGN.md)、[README.md](../README.md) 为准，本文不复制其内容。
> 维护约定：同一时间只由一名指定维护者编辑；在任务分配或任务完成节点更新，且每次更新都要附实际证据。

- 文件版本：v1（初始化）
- 最后更新：2026-10-15
- 最后更新者：DSH
- 更新节点：Collaboration Setup 01 完成

## 1. 当前稳定基线

| 项 | 值 | 核实方式（2026-10-15） |
| --- | --- | --- |
| 项目 | Job Radar | — |
| 状态 | Product Improvement v1 Released / Frozen | User 确认 |
| Production commit | `18e042297f2b572f160bedad777e5edb5777810d` | `git rev-parse HEAD`，本地与 `origin` 一致 |
| Production branch | `task-1-m0-contracts` | `git ls-remote --symref origin HEAD` |
| DSH branch | `work/dsh`（纯本地，无 upstream，未推送） | `git for-each-ref refs/heads` |
| 正式网站 | (production deployment not published) | 实测 HTTP 200；`/radar` 已渲染 Radar / Saved / Profile |

**核实边界（同日期）**

- 远端只有 `task-1-m0-contracts` 一个分支，其 HEAD 符号引用指向它；该 SHA 与 `work/dsh`、本地 `task-1-m0-contracts` 四方一致，无分叉、无领先/落后提交，工作区 clean，共 24 个提交，无 tag。
- **线上站点的构建 SHA 无法独立核实**：只能由 `/saved` 路由推出线上版本晚于 M0 冻结版本，**不能断言线上等于上述 Production commit**。
- `task-1-m0-contracts` 已关联 Vercel Production 自动部署（见 [2026-10-09 地点归一报告](reports/2026-10-09-location-normalization.md)）。因此**未经明确授权，不向该分支提交或 push**。

## 2. 协作角色

| 角色 | 职责 |
| --- | --- |
| User | 方向、优先级与最终批准；唯一授权来源。 |
| ChatGPT | 项目协调、任务拆解、验收建议与跨 AI 进度核对。不假定能自动读取未同步的本地修改。 |
| Codex | 按明确授权执行工程任务。 |
| DSH | 按明确授权执行独立开发、分析、测试与文档任务。 |

角色描述不构成永久的模型能力等级判断，具体任务可重新分配。

## 3. 当前任务记录

状态取值：`Planned / In Progress / Review / Completed / Blocked`

| Task ID | Task | Owner | Status | Branch/Commit | Next Action |
| --- | --- | --- | --- | --- | --- |
| SETUP-01 | 建立共享项目交接文件 | DSH | Completed | `work/dsh`（`18e0422` 之后的首个提交） | 无 |
| — | 当前无进行中的产品开发任务 | — | — | — | 等待 User 分配 |

本表只登记**已授权且有实际证据**的任务；未分配的工作不预填 Owner、不虚构进度。

## 4. 最近完成事项

| 事项 | 状态 | 关键结果 / 证据 |
| --- | --- | --- |
| Product Improvement v1 Task 1–4 | Completed（已验收，未部署） | 地点归一与城市筛选；组合筛选与偏好应用；最小 Saved；时间与招聘状态表达。均为本地 production 模式验收，各报告一致声明「不 push、不部署」。见 [2026-10-09](reports/2026-10-09-location-normalization.md)、[2026-10-10 筛选/偏好](reports/2026-10-10-browse-filters-preference-integration.md)、[2026-10-10 Saved](reports/2026-10-10-minimal-saved-jobs.md)、[2026-10-15 时间与状态](reports/2026-10-15-freshness-status-clarity.md)。 |
| Final Integration Review | Completed | User 确认；本轮未复核其明细。 |
| Production Release | Released | 正式网站实测 HTTP 200，且线上已包含 Saved 路由。**构建 SHA 未独立核实**（见第 1 节）。 |
| DSH worktree 接入 | Completed | `E:\job-radar-dsh` 建立于 `work/dsh` @ `18e0422`；只读接入确认已通过。 |

只列关键结果，不复制详细历史；完整过程见 [reports/](reports/)。

## 5. 待处理事项（Backlog / 待确认，均未获开发授权）

**A. 已知非阻断问题**

- extraction 未就绪岗位：63 条失败保持 `Check`（31 条 parser×validator 兼容 + 32 条模型拒绝）待专项审计；不自动重试。
- 迁移历史 debt：本地 `0001_job_radar_m0.sql` ↔ 远端 `20260928013502_job_radar_m0`；禁止重复执行初始 DDL，未做 history repair。
- 真实库无 `Closed` 样本，且所有 run 均为 `full_list=false`，**不得据此推断任何 Closed**。
- 来源字段缺失：`published_at` 大量为空（显示「未提供」）；NCSS 无详情与申请链接。

**B. 后续产品候选方向（未授权，需 User 决策）**

- M1 其余能力：Hide + Undo、Seen/New、inline profile completion、Compare、账号同步。
- 来源侧：NCSS 扩页、新来源接入（ByteDance / Xiaomi 曾 429，Horizon、NIO 等 Later 项）；实习僧因上游协议限制已 Drop。
- 更长期：JD Lens。

**C. 环境与文档维护事项**

- 文档漂移：`README.md` 第 257 行仍写「M1 未实现：Saved…」与「尚未进行 Vercel 部署」，均与当前实际不符。
- Skill 授权不一致：AGENTS.md 与 DESIGN.md 只授权 `anti-ui-slop` 和 `web-design-guidelines`，但仓库实际装有 4 个（另有 `hallmark`、`visual-quality-final-audit`）。**User 确认前不使用后两者。**
- DSH worktree 缺 `node_modules`、`.env.local`、`.verification/`，lint / typecheck / test / build 当前无法运行，需先 `npm ci`。
- Git 全局配置 `http.proxy = http://127.0.0.1:7890` 当前不可用，`fetch/push` 会失败；直连 443 正常。本轮未修改该配置。
- 以上各项（除 DSH worktree 依赖准备外）均需单独授权后处理。

## 6. 协作规则

1. 同一个开发任务只有一个执行 Owner。
2. 两个 AI 不同时修改同一个任务范围；发现冲突先指出并等待重新分配，不做竞争性修改。
3. 每次工作前先检查：Git 状态（分支 / HEAD / 工作区）、当前任务记录、相关冻结规则。
4. 本地 worktree 不会自动同步未合并改动；不得假定他人能看到本地未提交内容。
5. 任务提交时说明：修改文件、测试结果、commit、已知风险。
6. 未经 User 授权：不 push、不部署、不写入生产数据库、不修改生产环境变量与自动刷新流水线。
7. 生产部署与历史完成状态**不等于**当前任务授权。
8. 本文件由指定维护者按任务分配或完成节点更新，避免双方同时编辑。
9. 每次状态更新必须有实际证据（命令输出、报告、commit），不得仅依据模型推测。
10. 不擅自修改已冻结的 Qualification、Evidence、Reliability 语义。
