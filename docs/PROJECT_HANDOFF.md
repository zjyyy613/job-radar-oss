# Job Radar — 三方协作交接文件

> 本文件只记录**协作状态**（谁在做什么、做到哪、下一步），不替代任何业务规则与技术规范。
> 业务与冻结规则以 [Product Spec v1.0](specs/job-radar-product-spec-v1.0.md)、[Technical Architecture v0.1](architecture/job-radar-technical-architecture-v0.1.md)、[DESIGN.md](../DESIGN.md)、[README.md](../README.md) 为准，本文不复制其内容。
> 维护约定：本文件由 **DSH 作为主要维护者**更新，ChatGPT 负责项目协调与任务状态核对，Codex 读取本文件的交接信息；按任务分配或完成节点更新，避免双方同时编辑，且每次更新都要附实际证据。

- 文件版本：v2
- 最后更新：2026-10-15
- 最后更新者：DSH
- 更新节点：Collaboration Setup 02（最小文档状态同步）完成

## 1. 当前稳定基线

| 项 | 值 | 核实方式（2026-10-15） |
| --- | --- | --- |
| 项目 | Job Radar | — |
| 状态 | Product Improvement v1 Released / Frozen | User 确认 |
| GitHub 生产分支 | `task-1-m0-contracts` | `git ls-remote --symref origin HEAD` |
| 生产分支 commit（GitHub） | `18e042297f2b572f160bedad777e5edb5777810d` | 同一次 `ls-remote`，与 DSH 本地基线一致 |
| 已部署版本（Vercel Production） | `18e042297f2b572f160bedad777e5edb5777810d` | **由 ChatGPT 通过 Vercel 部署接口核实**；DSH 未独立验证 |
| DSH 本地分支 / HEAD | `work/dsh` / `3016bed…`（纯本地，无 upstream，未推送） | `git rev-parse` |
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
| SETUP-02 | 最小文档状态同步（交接文件 / README / AGENTS.md / DESIGN.md） | DSH | Completed | `work/dsh`（本轮文档提交） | 无 |
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

- DSH worktree 缺 `node_modules`、`.env.local`、`.verification/`，lint / typecheck / test / build 当前无法运行，需先 `npm ci`。
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
