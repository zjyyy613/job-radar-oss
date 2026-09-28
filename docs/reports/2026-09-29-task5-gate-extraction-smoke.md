# Task 5 — Gate Extraction smoke 与自审

执行日期：2026-09-29，Asia/Shanghai。基线：`7379dc9`。仅 Task 5；没有实现 Qualification Engine、Profile/Radar UI 或 Task 6。

## 实现与配置

- 使用用户已配置的服务端 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL=https://api.deepseek.com`、`DEEPSEEK_MODEL=deepseek-flash`。
- **仅 `POST /responses`**，`text.format.type=json_schema`，封闭对象（所有属性 required，`additionalProperties=false`）。没有切换 Chat Completions，也没有新增 SDK。
- `reasoning.effort=none`、`temperature=0`、`max_output_tokens=4096`；90 秒单请求超时、禁止跳转、无自动重试。
- 原生 fetch 只发送未解析子句、来源与 required/preferred/ambiguous 上下文，不发送环境变量、旧 gates、整个 source payload。
- 独立 `validateExtraction` 复用 frozen `validateGate`，再验证源文本逐字 evidence/context、Spike 词表、字段和值支持、语义强度、标题范围、OR 与模型处理范围。模型输出 invalid 时整次失败，绝不部分覆盖旧 gates。
- 官方协议依据：[Responses API](https://api-docs.deepseek.com/api/create-response/)、[Responses guide](https://api-docs.deepseek.com/guides/responses_api/)。采用已支持的 `text.format` schema 形式，不凭空加入协议未列出的 `strict` 参数。

Parser 覆盖明确在校身份、毕业届别、学历、专业、days/week、duration_months、已审研究领域、简单及跨字段 OR。标题单独 `2027届/27届` 为 ambiguous/program；正文明确限制时使用正文；专业/经验优先保持 preferred。否定、上限、未知专业备选项保守保留 metadata，不猜测下限或删除未知选项。

模型仅接收复杂/未解决语义。本次 corpus 的调用点是小米复合学历/科研意愿 OR，以及 vivo 混合研究领域列表。required Gate 必须有确定性语义确认；不能由模型发明新的硬性门槛。

## 六条真实 Spike 样本

从用户指定 Spike 复制最小回归材料；没有迁入 Flask、旧 profile/engine 或整个项目。出处与旧/新表示映射见 `tests/fixtures/gates/README.md`。

最终六岗位 live 回归：**6/6 success，2 次模型调用，总计 3,268 ms（逐岗位耗时合计；不含进程启动）**。

| 样本 | gates | metadata | 模型调用 | 耗时 ms | 核验重点 |
|---|---:|---:|---:|---:|---|
| Tencent 解决方案 | 1 | 0 | 0 | 4 | 理工科 required，不从应届实习标签推断学籍 |
| Tencent 技术产品商务 | 1 | 0 | 0 | 0 | 专业 preferred |
| Xiaomi 具身研究员 | 1 | 2 | 1 | 2137 | 研究方向；复合 OR 完整保留为非阻断分支 |
| Xiaomi COE 2027 | 6 | 2 | 0 | 1 | title ambiguous/program，学籍/学历/5天/6个月，专业 preferred |
| vivo 影像博士 | 3 | 2 | 1 | 1126 | 博士 required，相关计算机专业 required，title ambiguous/program |
| vivo 品质工程师 | 3 | 0 | 0 | 0 | 本科与专业 required，title ambiguous/program |

历史 Spike 第二轮实际为 **5/6 semantic_valid**，不是六条全对。已保留其非法 `research_areas=ml` 为拒绝回归；不扩大词表来迁就模型。历史 24/24 是旧人工审阅/引擎的报告计数，不是本阶段实现了 Qualification Engine。

### live 调试中发现并修复

1. `专业能力：` 章节标签曾触发多余调用，已在 parser 排除。
2. 提供完整 JD 时，模型有时越界输出已解析条款。validator 拒绝，未持久化。捕获一条真实越界输出为负向 fixture；请求改为仅传未解析子句后，最终六条全部通过。
3. 不放宽 validator 接受未知 `ml` 或无关 evidence，也不把失败结果当正确 fixture。

## 真实 Supabase smoke

项目：`uajefuhoberdghxtxqte`。已应用迁移 `20260928175131_gate_extraction.sql`，本地版本与远端一致。

只选现有 3 个 jobs；没有插入 Spike fixture，也没有给所有 8 条无差别调用模型。

| job ID | 岗位 | 最终状态 | gates |
|---|---|---|---:|
| `58bcedda-14fa-8c66-a055-0a17e9009d49` | Tencent Agent开发工程师 | success / deterministic | 0 |
| `6315d88f-cff0-8e58-a9b9-b44c7100e88d` | vivo Agent算法工程师 | success / deterministic | 2 |
| `c83965bc-af1c-8ba5-a455-128b1fd86cdb` | NCSS 中国银行招聘公告 | success / deterministic | 0 |

Tencent 的文本只包含技能/工具等非 M0 条件，NCSS 该条没有 description/requirements，因此两者正确保留 `gates=[]`。vivo 正文明确“2027届获得博士学历”，写入 required graduation_year=2027 与 education one_of=[doctorate]；证据逐字保留该句。

第一次真实批次：2 success、1 failed，模型调用 1 次，逐岗位耗时 821 / 2320 / 277 ms，合计 **3,418 ms**（包含写入）。vivo 专业列表含冻结词表之外的“软件工程”，模型输出未通过校验。失败已写入状态；另外两条继续成功，旧 gates 未被覆盖。

修复为 parser 直接保留完整未知专业列表 metadata 后，对该已知失败行做了一次**人工控制的纯 parser 原子修复**：先在本地独立验证结果且断言 `model_calls=0`；同一 SQL 事务内仅在指定 ID、当前 hash、failed 状态都匹配时清除 attempt hash，再调用既有 CAS RPC 写入。不是 runner 自动重试，未再次调用模型。数据库确认 gate_count=2，input/attempt hash 均等于当前 raw_content_hash。失败经过与修复保留在本报告，临时 SQL 在忽略目录中。

修复后再次执行同一 `--write`：**3 skipped、0 次模型调用、0 次写入**。成功和失败缓存都已实际验证会跳过；最终复查为：

- `source_records=8`，`source_runs=7`，`jobs=8`，来源表及状态未改动。
- `extraction_status=success` 的 jobs 为 3，failed 为 0；5 条未处理。
- 总 gates=2；三个已处理 jobs 的 successful input hash 均与当前内容 hash 相等。
- 每条成功结果具有 `extraction_version=spike-v2-m0-v1`、数据库 `extracted_at`、`extractor_type`。

## 持久化保护

- 增加 jobs 内部 extraction bookkeeping，不修改 frozen Gate/Profile/SourceRecord 契约。
- `extraction_input_hash` 表示最后成功结果；`extraction_attempt_hash` 包含失败尝试。无变化内容（包括失败）不自动调用模型，版本升级也不自动重抽。
- failure 只更新 attempt/status/error/time，保留原 gates、成功 hash、extracted_at、version、extractor_type、metadata。
- RPC 行锁 + 当前 hash / attempt hash CAS，拒绝旧 JD 的迟到结果与重复写入；只给 service_role execute 权限。
- canonicalization 的 ON CONFLICT 继续只改 canonical 字段，保留提取列；不更改去重、来源优先级或关闭判定。
- PGlite 已实际验证新 JD + invalid extraction 保留旧有效 gates、失败缓存、stale write 拒绝、空/伪造 evidence 拒绝、anon 无写入权限，以及后续 canonicalization 保留成功提取。
- Supabase security advisors 无新增告警；只有原有 source_records/source_runs 的 RLS 无公开 policy 两项 INFO，符合 server-only 设计。[说明](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)。

## 自审与最终验证

已自审并修复：章节标签多余调用、全 JD 导致越界提取、未知专业列表缩窄风险、跨字段 OR 被拆开风险、否定/上限/届别范围误作最低要求、canonicalization 与提取共存保护、陈旧写入及密钥/错误正文泄露。

最终检查：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build` **全部通过**；Vitest **13 文件 / 213 tests**（其中 NCSS bridge 另执行既有 Python 离线测试）。`git diff --check` 通过。六条原始 JD fixture 与 Spike 原文件 SHA-256 相同。

离线回归覆盖六真实样本、required/preferred/ambiguous、学历/天数/月数、OR、malformed/unsupported/empty evidence、逐字 grounding、hash skip/change 和 invalid fallback。所有 unit tests 离线运行；真实调用仅在显式 live 命令中。

## 修改文件与边界

- `scripts/ingest/`: parser/vocabulary、runtime validation、JSON schema、Responses wrapper、pipeline、Supabase store、bounded CLI；`canonicalize.ts` 接续提取保护。
- `supabase/migrations/20260928175131_gate_extraction.sql`: bookkeeping、原子写入和 canonicalization 兼容。
- `tests/ingest/`: extraction、Responses、真实 SQL 保护测试；`tests/domain/gate-validation.test.ts` 增补 frozen grammar 回归；`tests/fixtures/gates/` 最小真实语义资料。
- `.env.example`、`package.json`、`README.md` 和本报告：配置、执行入口与审计。无新依赖，无 frozen spec 修改。

Task 6 前没有未修复的 Task 5 实现阻塞。仍需明确保持：

1. 只做小规模 smoke，另外 5 条真实 jobs 尚未提取；不自动扩大本次范围。
2. 复杂 AND/OR、未知专业、工具/语言/经验等 metadata 不参与阻断。冻结 Gate 不支持的表达式不新增 Profile 字段。
3. 后续消费方需读取 extraction 状态及 input hash，识别失败后保留的旧 gates；不要把旧 JD 的证据当作新内容的成功提取。
4. 手动 runner 需串行。CAS 保证不覆盖，但没有新增分布式调用锁/队列，不能承诺两个同时启动的 runner 在写入前不重复付费调用。
5. 失败缓存不会无条件重试；修复需显式核实。本次人工纯 parser 修复不构成自动重抽策略。

完成后停止，不自动进入 Task 6。
