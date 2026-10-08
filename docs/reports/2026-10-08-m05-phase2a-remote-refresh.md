# M0.5 Phase 2A — Automated Incremental Pipeline & Remote Actions Smoke

日期：2026-10-08。结论：**PASS**。M0、Phase 1A、Phase 1B 的产品、UI、Gate 和来源边界保持不变；未进入 M1 或部署。

## Workflow 注册与执行

私有仓库 `zjyyy613/job-radar`，默认分支 `task-1-m0-contracts`。远端 `e21517a2ad36d5db63a27d4c285d7231389a888a` 与本地一致。此前 dispatch 404 时，Actions workflow 列表为空；同一 workflow 更名为 `.github/workflows/refresh.yml` 并由用户成功推送后，API 返回 active（ID 378371506）。默认分支和文件路径正确，无需再次修复注册。无法从 API 证明 GitHub 内部索引的具体原因，不将网络失败与注册问题混为一谈。

本轮 GH 网络使用进程级 `HTTPS_PROXY=http://127.0.0.1:9876`，Git push 使用命令级代理；未修改全局配置或 Git 历史。三个 repository Secrets 已存在，未重新上传。

| 真实手动运行 | 结果 | refresh 耗时 |
|---|---|---:|
| [首次 smoke](https://github.com/zjyyy613/job-radar/actions/runs/37770003608) | success | 84.613s |
| [再次增量运行](https://github.com/zjyyy613/job-radar/actions/runs/37770896635) | success | 68.430s |
| [恢复首次 checkpoint](https://github.com/zjyyy613/job-radar/actions/runs/37770968830) | success | 12.210s |

运行均使用 8 个既有 Batch A、intern、每页 2 条、每源 1 页/2 条、全局 16 条、模型请求硬上限 16。恢复运行在第二轮进行时被并发锁排队，未同时写库；恢复 artifact 校验成功。

## 真实结果与对账

| 指标 | 首次 | 第二次 | checkpoint 恢复本次新增工作 |
|---|---:|---:|---:|
| sources attempted / success / partial / failed | 8 / 8 / 0 / 0 | 8 / 8 / 0 / 0 | 0 / 0 / 0 / 0 |
| listed / detail success / admitted | 16 / 16 / 16 | 16 / 16 / 16 | 0 / 0 / 0 |
| inserted / updated | 4 / 12 | 1 / 15 | 0 / 0 |
| unchanged（updated 的子集） | 12 | 15 | 0 |
| canonical new / changed | 4 / 0 | 1 / 0 | 0 / 0 |
| extraction pending / parser-only | 4 / 4 | 1 / 1 | 0 / 0 |
| model calls | 0 | 0 | 0 |
| extraction success / failure | 4 / 0 | 1 / 0 | 0 / 0 |
| records / jobs | 408 / 408 | 409 / 409 | 409 / 409 |
| ready jobs | 345 | 346 | 346 |
| Open / Unknown / Closed | 22 / 386 / 0 | 22 / 387 / 0 | 22 / 387 / 0 |
| evidence quotes verified | 385 | 386 | 386 |

恢复 summary 中 ingestion metrics、baseline 和 model calls 沿用 checkpoint 的累计值，不能把它们重复算作本次抓取。数据库 source_runs 相对基线恰好新增 16 条，对应两次 fresh run；恢复没有新增 source run。

两次 fresh run 每家公司均 1 页、2 listed / detail attempted / detail success / admitted，0 rejection / failure，stop_reason=max_jobs：Alibaba、Meituan、JD、NetEase、Kuaishou、OPPO、Li Auto、Ant Group。所有 16 个 source run ID 在数据库中可对账，full_list 均为 false。

相对 **404 records / 404 jobs / 341 ready** 基线，新增 5 jobs / 5 ready：美团 source ID `4826108851`、`4697447655`、`4491530478`，网易 `79168`、`78226`。第二轮列表又出现 1 条新岗位，不是 duplicate rerun。stable source identity 无重复；原有岗位未删除。当前同 hash 的 63 条 extraction failure 全部保留原结果；missing count 无增加。

Open 从历史 256 降为 22、Unknown 从 148 增为 387：既有 conservative reliability 将未在最新 bounded run 出现的记录保持/转为 Unknown；并未推断关闭，Closed 始终 0。不能将有界页面视作完整快照。本轮未改变该语义。

真实新增和 unchanged 路径已验证。真实样本没有 JD hash 变化，也没有来源或模型失败；changed-hash rerun、单 source 失败不回滚、模型失败隔离和旧 gates 保留由自动测试验证，没有人为破坏生产源或修改 JD 制造测试。新增全部 parser-only，因此本轮没有发出 DeepSeek 请求；不是缺少模型配置，也没有为证明模型可用而强行调用。

## 增量、安全与恢复边界

复用现有 store/upsert、canonicalization RPC、parser/schema/model fallback 和 Phase 1B batch checkpoint。未增加 adapter、依赖或状态系统。同 hash + current successful 跳过；新 job / changed hash / stale successful version 进入提取。已知同 hash failed 暂不重试，继续 Check。

workflow_dispatch、45 分钟超时、共享 production writer lock、source isolation、page/job/global/model cap、串行模型调用、既有 request timeout/retry/backoff、checkpoint 恢复均保留。partial 可完成并 exit 0；全失败、预算未完成、写入不明 exit 非零并输出安全失败摘要。

ingestion 完成前中断可能重复有界读取和幂等 upsert；不保证 source reads exactly-once。模型额度先 checkpoint，uncertain 请求不自动重试。runner 强杀且 artifact 未上传时须人工核对，不假定恢复成功。artifact 只保留 checkpoint/summary 14 天。

首轮 manual smoke 成功后配置每日 UTC 23:17（北京时间次日 07:17），使用同一 pipeline，默认全局 16 条/模型最多 8 次；显式 model_cap=0 仍保持 0。NCSS 不设 schedule。尚未等待首次 cron 实际触发，不把手动 smoke 当作 cron 已运行。

## Supabase migration/history

只读检查：三表 RLS、unique(source,source_job_id)、状态/evidence 约束、readiness 字段与本地一致。从空 PGlite 顺序重放三份 migration 后，RPC 定义 MD5 与远端完全一致：

| RPC | 本地 / 远端相同 MD5 |
|---|---|
| apply_canonicalization | a7c628662d7f032c4382ab9f5914aef6 |
| canonicalization_snapshot | 5333c6312de49bf67be5de54fbf7951e |
| write_gate_extraction | b4bb9aed3a4917e59952d455d743fe18 |

无损保留的 infrastructure debt：本地初始 `0001` 对应远端 `20260928013502`；后两条版本 `20260928122238`、`20260928175131` 一致。未执行 history repair、DDL、reset、db push 或删除真实数据。新环境可顺序重建；未来使用 migration CLI 前必须核对初始映射，不能重复初始 DDL。

## 安全、自审与质量

- 完整下载三次 Actions 日志及 artifact，在本地忽略目录审查；9 个文件与实际配置的敏感值比对，0 泄漏。仓库历史扫描 406 blobs，credential matches=0，禁止的 env 路径=0。
- 密钥仅注入服务器 workflow 步骤，无客户端改动。未重新上传 Secrets，未把值写入报告、代码或 artifact。
- 自审修复 schedule 无 inputs 时的 model cap 默认值，同时保留手动 0；README 移除过时的无 remote / 未 push / 旧独立 schedule 描述。未调整 extraction 或 qualification 规则。
- lint、typecheck、21 files / **343 tests**、production build 全通过。git diff --check 通过。
- 自动测试覆盖 new/unchanged/changed、same-hash failed、checkpoint、partial source isolation、capped missing 不 Closed、writer lock、Secrets 边界；既有模型额度、证据校验和 previous-valid-gates 用例继续通过。

## 后续事项（不阻断本轮）

- 63 条既有 extraction failure 继续 Check，本轮不修 parser / model rejection。
- 初始 migration version 映射、首次 scheduled run 观察、Actions v4 的 Node runtime deprecation 警告作为 infrastructure follow-up；三次实际执行均成功，不在本轮额外升级 Actions。
- 当前 daily cap 只更新少量第一页岗位，不是全站覆盖或完整 freshness 承诺；未来提高覆盖仍须显式调整预算和分页策略。
- 不进入 M1、NCSS 扩页、新 source、UI 修改或 Vercel deployment。
