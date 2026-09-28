# Task 2：job-pro 真实 smoke 与自审

## 范围与版本

- 基线：Task 1 提交 `1f5f034`；领域契约、初始迁移、冻结文档和 UI 均未修改。
- 固定 `@ha7ch/job-pro@1.2.1`；仅调用公开 CLI 的 search/detail。
- 三家 allowlist：Tencent、Xiaomi、vivo；没有运行 find/all 或其他来源。
- 六份真实 fixture 于 2026-09-28 00:49–00:50（Asia/Shanghai）采集，先于 adapter contract tests。

## 真实 Supabase 验证

新建 Job Radar 项目的 public schema 最初为空，API 返回 PGRST205。
已原样应用验收过的 `supabase/migrations/0001_job_radar_m0.sql`，未新增/修改 schema。
Supabase 记录的迁移名为 `job_radar_m0`、版本为 `20260928013502`。
这是工具生成的远程历史版本；本地保留计划指定的 `0001` 文件名。以后若切换到 CLI `db push` 管理迁移，需要先对齐两边历史，不能将初始 DDL 重复应用。

使用 `.env.local` 中的 `SUPABASE_SECRET_KEY`，仅在服务端 apikey 请求头使用，未输出密钥。

运行命令（两轮相同）：

```sh
npm run ingest:job-pro -- --write --sources tencent,xiaomi,vivo --scope campus --limit 2
```

实际以等价的 `node --import tsx scripts/ingest/run-job-pro.ts ...` 调用 runner 并保存 JSON 报告。

| 来源 | 首轮新增 | 复跑新增 | 复跑更新 | 最终来源记录 | 失败 |
| --- | ---: | ---: | ---: | ---: | --- |
| job-pro:tencent | 2 | 0 | 2 | 2 | 无 |
| job-pro:xiaomi | 2 | 0 | 2 | 2 | 无 |
| job-pro:vivo | 2 | 0 | 2 | 2 | 无 |

- 首轮：2026-09-28 09:37:26–09:37:44（Asia/Shanghai）。
- 复跑：2026-09-28 09:39:31–09:39:47（Asia/Shanghai）。
- 读回：6 条 `source_records`、6 条成功 `source_runs`；所有 run `full_list=false`；`jobs` 为 0 条。
- 6/6 条记录的 ID、标题、描述和要求与各自 raw_payload 相符；没有重复来源身份。
- Tencent IDs：`1282707398326592512`、`1282707395466077184`。
- Xiaomi IDs：`7689291997559884086`、`7687793695115200795`。
- vivo IDs：`561286383`、`561282866`。
- 首轮 run IDs：`59cdacda-e801-4bae-9e87-4440c2d1fe58`、`a3fb56f1-1f53-4d78-a16f-df844ef0cd3c`、`d5f7b359-ef9e-40c4-a6fd-3f13a6ae62bf`。
- 复跑 run IDs：`774bab4b-bf36-4432-9ea6-9d6e898526fd`、`249a6979-2295-4c8c-8b94-41333a8cdc60`、`b987831d-3d1b-4f52-a595-7d2c84199c30`。

## 自审与边界

- 最终 `npm run lint`、`npm run typecheck`、`npm test`（6 个文件 / 128 项）、`npm run build` 全部通过。
- 检查来源隔离、原始载荷、空值、字符串大整数 ID、跨源身份、权限、固定版本、进程参数、幂等、故障隔离与任务范围。
- 修复了“total 非零但 positions 为空”被误报成功的问题；回归测试先失败，再修复。
- 加入公司级 5 分钟预算，避免连续慢详情占满 workflow 并阻塞后续来源；回归测试先失败，再修复。
- offline 测试模拟单家公司/详情/写入/审计失败；没有人为污染真实来源运行记录。
- Supabase security advisor 没有 WARN/ERROR，仅对 source_records/source_runs 提示两项 INFO：
  [RLS enabled without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)。
  两张表按已验收设计仅允许服务端角色访问，不为浏览器开放 policy；保留该预期配置。
- 本次真实 smoke 为 campus 渠道小样本，不能证明所有岗位或 intern 渠道均可用；无法识别的信息不从标题、部门、招聘标签推断。
- vivo 无时区的发布时间仍只保留在 raw_payload；未补造标准时间。
- 本次未推送 workflow、未配置远端 Secrets、未在 GitHub 执行；本地环境变量不会自动成为 GitHub Secrets。
- 停在 Task 2，未执行 Task 3。
