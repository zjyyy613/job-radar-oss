# Task 4 canonicalization / source reliability — 2026-09-28

## 范围与基线

- 验收基线：`661600f`；开始时工作区 clean。
- 仅 Task 4：确定性 canonicalization、来源可靠性、jobs 原子写入与审计。
- 未修改冻结 Product Spec、Technical Architecture、SourceRecord、CanonicalJob 或资格语义。
- 无 Gate Extraction、DeepSeek、Qualification Engine、UI、向量或 embeddings。

## 实现规则

1. `(source, source_job_id)` 为身份，重复输入保留最新版本；同源不同 ID 不自动合并。
2. 跨源必须同时满足 company/title 的 NFKC、大小写、空白归一化后精确相同，地点有交集，
   recruitment_batch 明确且归一化一致，internship_type 无冲突。批次缺失/空白不猜测兼容。
3. 保留公司后缀、岗位标点与 program 内容，不做别名、模糊匹配、LLM 或语义检索。
4. 组内每一对都必须相容；拒绝地点传递桥接和多个同源候选之间的任意选择。
5. canonical 内容来自权威等级最高的一条完整记录；同级优先最新抓取，然后稳定身份排序。
   不从 raw payload 读取来源专有字段，也不拼接不存在的字段。
6. trace 包含版本、主来源、每次自动 merge 的参与 ID/reason、来源状态及 run ID。
   命令 JSON 另外给出所有 pair 的 merge/no-merge 原因；本次 28 对均不合并。
7. 保留已有 job ID，拆分时防止 ID 冲突。内容 hash 不含抓取元数据、状态或 gates。

## 来源状态与审计表示

现有 `SourceRecord` 没有岗位显式关闭属性，原 `SourceRun` 也没有完整列表成员快照。
本阶段增加来源无关的内部审计表示，不反过来解析 raw payload：

- `source_runs.record_observations`：可选 `{present: string[], closed: string[]}`，成员为该 source 的 source_job_id。
- NULL 表示无历史快照，不能当作空列表。closed 只允许 adapter 已确认的明确上游关闭状态。
- full_list=true 必须覆盖 source key 的全部 program；当前 Task 2/3 都是 bounded run，仍为 false。
- `jobs.canonicalization_trace`：当前合并与状态依据；冻结领域对象的业务语义不变。

按 run 时间重放证据，而不是对每次 canonicalization 调用累加计数：

- authoritative 的成功出现证据 => open。旧 run 无快照时，只允许用 last_seen_at 落在成功窗口内证明出现。
- 一次 success + authoritative + full_list + 完整快照缺失 => unknown / count=1；连续第二次 => closed / count=2。
- failed => unknown，不增加 missing count；failed/partial/非完整证据打断缺失链。
  保留最近计数供审计，下一次有效缺失从 1 重新开始。
- 明确上游 closed 可立即 closed；failed run 中的值不可信；partial 中明确核验的 closed 仍可使用。
- NCSS/trusted_aggregator 的出现不冒充官方 open，缺失不能增加权威缺失计数或关闭。
- 同组有权威来源时使用权威状态；新鲜权威 open 与明确权威 closed 冲突时返回 unknown。
- 不从网络错误、deadline、标题、当前可变的 last_seen_at 反推出历史缺失/关闭。
- 没有添加 TTL；状态表示最新已记录的来源证据，不是额外实时探测的承诺。

## 数据库与运行入口

- 迁移：`20260928122238_canonicalization_reliability.sql`，本地/远端新版本已对齐。
- 仅为现有表增加两个审计字段，以及服务端 snapshot/apply RPC；不增加外部基础设施。
- RPC 为 security invoker，固定 search_path；撤销 PUBLIC/anon/authenticated 执行权限，仅 service_role 可用。
- snapshot 单次读取来源、运行、已有 jobs；预算为 1,000 records / 10,000 runs，超出直接拒绝，不分页截断。
- apply 在单事务中锁定并复核 snapshot token，要求每个 source record 恰好链接一次，原子 upsert/移除被替代的 canonical 行。
- 不改 source_records/source_runs 的内容，不把来源失败变为批量删除/关闭。
- 检测到已有 gates 或 extraction 元数据时拒绝覆盖；Task 5 必须接续保护，而非清空已有提取结果。
- 服务端密钥优先 SUPABASE_SECRET_KEY，使用 apikey；旧 JWT fallback 保持兼容。无密钥输出。

```sh
npm run canonicalize -- --dry-run
npm run canonicalize -- --write
```

## 真实 smoke 与幂等复跑

使用现有真实记录，没有重新抓取来源，也没有将测试 fixture 写入 Supabase。

| 来源 | source_records | jobs | open | unknown | closed |
| --- | ---: | ---: | ---: | ---: | ---: |
| job-pro:tencent | 2 | 2 | 2 | 0 | 0 |
| job-pro:xiaomi | 2 | 2 | 2 | 0 | 0 |
| job-pro:vivo | 2 | 2 | 2 | 0 | 0 |
| ncss | 2 | 2 | 0 | 2 | 0 |
| 合计 | 8 | 8 | 6 | 2 | 0 |

- 首次写入：2026-09-28 20:34:45（Asia/Shanghai），使用等价入口 `node --import tsx scripts/ingest/canonicalize.ts --write`。
- 正式 npm 入口复跑：20:35:43，8→8，无新增重复 job。
- 自动 merge 0 组；28 对 no-merge：24 对 company_mismatch、4 对 different_ids_same_source。
- 8 个唯一来源关联，各 job 仅关联一个来源；没有跨腾讯/小米/vivo/NCSS 的错误合并。
- 8/8 jobs 的标题、公司、description、requirements 与来源一致，原始 JD 未截断。
- 8/8 gates=[]，extraction 元数据为 null，missing count=0，trace 版本正确。
- 复跑前后完整 jobs 行哈希：`38bc7a317ef36119b2123d6f970e9dfe`，完全一致。
- source_records 内容哈希前后：`27a128b47c7cfa2254c827529af23ff8`。
- source_runs 原有字段哈希前后：`34ad888ae8c71759ce2e51aac9a8ebf9`；排除新增 null 审计列，仍为 7 行。

## 测试、自审与修复

- 按计划先编写测试；模块未实现时确认失败。
- 最终 lint / typecheck / 全量 test / build 均通过：10 个 Vitest 文件 / 170 项测试，
  包含原有 NCSS 测试调用的 12 项 Python unittest。
- Task 4 新增 40 项：16 项 canonicalization、16 项 reliability、8 项数据库/runner。
- 覆盖同源身份、跨源高置信度合并、batch/program 冲突、弱标题相似、地点不兼容、
  所有要求的状态/来源隔离情形、trace、重复 run 去重、重新出现、幂等和来源优先级。
- PGlite 执行真实迁移，验证服务端权限、事务、stale snapshot 拒绝、完整唯一关联、
  提取元数据保护及重放不变。REST 测试验证鉴权、错误脱敏、不盲目重试与写入确认。
- 自审先复现再修复的四个问题：
  1. 同一来源有两个相同候选时不能任意选一个合并。
  2. 旧组拆分时不能生成相同 job ID。
  3. 列表快照与同期 last_seen_at 矛盾时不能算缺失。
  4. 空白 batch 标签不能冒充明确 program 一致。
- 修正类型导入路径；排序改为稳定字符串顺序，避免依赖系统 locale。
- Supabase security advisor 无 WARN/ERROR，仅保留 Task 2/3 已知的两项
  [RLS enabled without policy INFO](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)，
  source_records/source_runs 仍按设计仅供服务端访问。

## 限制与 Task 5 交接

- 预演阶段曾有本地 CLI 停滞，数据库查询与独立 runner 调用正常；未据此认定明确根因。
  增加 CLI 整体 60 秒预算（RPC 30 秒）；最终正式入口真实写入和复跑均成功。
  超时/响应不明仍需先读数据库再决定重跑，不能假定事务没有提交。
- 当前真实数据没有高置信度重复、full-list 缺失或明确 closed；这些场景用离线测试验证，未伪造生产来源事件。
- 当前 adapter 不生成 full-list/explicit-closed 快照；将来开启此能力前，必须提供完整、正确作用域的 record_observations。
- Task 5 接入提取时须保留已有 gates/提取元数据，并与 raw_content_hash 的变更机制接续；本阶段只加防覆盖保护。
- 原 `0001` 与远端 `20260928013502` 的历史版本差异仍在，未来使用 `supabase db push` 前先对齐；不要重复执行初始 DDL。
- 无 Task 4 验收阻塞。未推送、未进入 Task 5。
