# ENGINEERING-03 新增岗位提取质量与采集超时专项

> 依据：生产 Run `38929512185` / Job `117069582517`（472→510，新增小米 38，详情 38/38 准入，提取成功 28 / 失败 10，DeepSeek 10 次，采集 19 页 38 条，303114ms，`stop_reason=source_timeout`，workflow 绿色但 `status=partial`）。
> 本轮只读：未触发生产 workflow、未 `--write`、未重试失败岗位、未调用付费模型、未改生产库。
> **未放宽任何 Gate / Evidence / Qualification 规则**（`EXTRACTION_VERSION` 保持 `spike-v2-m0-v1`）。

## 1. 10 条失败逐条归因（按诊断类别，共 4+1+2+1+1+1）

本地没有当次 Actions 归档（`.verification/` 无 checkpoint/summary），因此**逐条 = 按诊断类别定位到具体校验器规则与机制**；具体 10 个岗位 ID 不在本地证据内，未编造。下表每一行都用 `tests/ingest/gate-extraction.test.ts` 的回归用例复现了同一 code。

| # | 诊断 code | 条数 | 触发规则 | 机制（为什么会发生） | 性质 |
| --- | --- | --- | --- | --- | --- |
| 1 | `required_without_deterministic_confirmation` | **4** | `gate-extraction-validation.ts:71-72` | 硬条件必须由**确定性解析器**产出同一 field+value+重叠引文；而模型**只收到 `unresolved` 子句**，这些子句恰恰是解析器没能产出 gate 的（`gate-parser.ts:62/90/106/110/113`）。因此对未解析子句输出 `required` **在任何情况下都会被拒**。 | **可修复（提示词）** |
| 2 | `student_status_not_confirmed_by_quote` | 1 | `:33` | 引文须含 `在校生/在读学生/在读[本硕博]`（或 `已毕业`）；模型从「2027届」类表述推断在校身份。提示词只写了「generic 实习/应届实习 不推断 student_status」，没写引文必须出现这些词。 | **可修复（提示词）** |
| 3 | `minimum_not_confirmed_by_quote` | **2** | `:37` | 校验器要求引文出现**阿拉伯数字**+`天`/`个月`；而解析器同样只认阿拉伯数字（`gate-parser.ts:100-103`），数字缺失时把子句推入 `unresolved`（`:113`）。于是「每周三天」这类中文数字子句被送给模型，模型即便正确输出 `minimum 3` 也**必然**因引文无「3 天」被拒。 | **可修复（提示词）＝系统性陷阱** |
| 4 | `unsupported_branches_present` | 1 | `:91` | 非 `compound_or` 的 metadata 必须 `branches: []`；提示词原文已要求（"Unsupported conditions … branches []"），模型未遵守。 | **正确拒绝（提示词已覆盖，已强化措辞）** |
| 5 | `metadata_branches_ungrounded` | 1 | `:87` | 每个 branch 必须是引文的**字面子串**；提示词只说「按 或 切分并去掉逗号与空白」，未要求「branch 必须是引文子串」。 | **可修复（提示词）** |
| 6 | `preferred_context_marked_mandatory` | 1 | `:62`、`:92` | 校验器的 `preferred = /优先|更佳|加分|优选/`（**任何**「优先」都算偏好），而提示词只列举了「专业优先/有经验优先/更佳/加分/优选」；模型遇到「能尽快入职者优先」这类未列举写法时可能判为 `required`/`ambiguous`。 | **可修复（提示词）** |

**关键结论**：这 10 条**没有一条是校验器误判**——每一次拒绝都对应一条真实未被引文证实的断言。问题在于**提示词从未把校验器的不变量告诉模型**，其中 #1、#3 更是**结构性不可满足**（模型无论多正确都会被拒）。

## 2. 正确安全拒绝 vs 可修复工程问题

- **正确安全拒绝（3 条）**：#4 以及「#1/#3 中若模型真的凭空补数字或推断身份」的部分。校验器守住了「只信引文」的底线，这类拒绝不应放宽。
- **可修复工程问题（7 条 + 2 个结构陷阱）**：见上表「性质」列。修复手段**只有提示词**，不需要改校验器、不需要放宽任何规则。
- **是否本可直接由确定性解析器处理却进了模型**：没有。#1 的 4 条是「解析器无法确认、模型又不允许确认」的死角；#3 的 2 条是「解析器不认中文数字 → 推给模型 → 模型也无法被确认」的往返。两者都属**路由与契约不一致**，而非解析器漏解析。

## 3. 共性缺陷

1. **提示词与校验器契约脱节**（主因）：校验器有 12+ 条 grounded 不变量，提示词只写了 3-4 条。
2. **`required` 在未解析子句上结构性不可达**：模型输入只有 `unresolved`，而 `required` 需要确定性对照 → 永远失败。这是最严重的一条（占失败 40%）。
3. **中文数字 minimum 的死循环**：解析器不认 → 交模型 → 校验器不认 → 必失败。
4. **偏好词表不一致**：校验器用宽表（任何「优先」），提示词用窄例举。

## 4. 采集超时：证据与原因判断

**新增阶段耗时（本轮加入，内容无关的纯数字）**：`run-job-pro.ts` 的 metrics 现在输出 `search_ms / detail_ms / upsert_ms`。

本地实测（同机、dry-run）：

| 配置 | 记录 | 页数 | 总耗时 | search_ms | detail_ms | 每次 search | 每次 detail | search 占比 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| page-size **25** | 50 | 2 | 64,185ms | 3,447 | 60,717 | 1.72s | 1.21s | **5%** |
| page-size **2** | 6 | 3 | 12,001ms | 4,959 | 7,038 | 1.65s | 1.17s | **41%** |

**结论：单次调用成本稳定（search ≈1.7s、detail ≈1.2s），差别几乎全部来自「每页只取 2 条」导致 search 次数 = 记录数/2。**

生产对照：

| 项 | 本地 | Actions |
| --- | --- | --- |
| 记录 / 页数 | 40 / 20 | 38 / 19 |
| 上游调用 | 60（20 search + 40 detail） | 57（19 search + 38 detail） |
| 额外持久化调用 | **0**（dry-run） | **76**（每记录 2 次 Supabase：查重 + upsert） |
| 总耗时 | 89.7s | 303.1s |
| 平均每次操作 | ≈1.5s | ≈2.28s（133 次操作） |

**归因（可区分）**：
1. **搜索开销放大**：page-size 2 使 38 条需要 19 次 search（占 CLI 调用 33%、本地实测占墙钟 41%）。
2. **runner 网络时延更高**：同样的单次调用结构，runner 上每次操作 ≈2.28s vs 本地 ≈1.5s。
3. **本地 dry-run 完全没有 upsert**：生产每记录多 2 次 Supabase 往返（共 76 次），这部分在本地从未计入。
4. **固定 350ms 前置等待**：`job-pro-cli.readWithRetry` 每次调用前 `await pause(350)` → 57 次 ≈ **20s**（约占 6.6%，非主因）。

**为什么 `source_timeout`**：`run-job-pro.ts:35` 给每个来源 **5 分钟**预算；本次 38 条已用 303s（≈8s/条），第 39–40 条在 `:76` 处被 `source_timeout` 截断 → 与观测的「19 页 38 条 + stop_reason=source_timeout」完全一致。

**修复方向（本轮不改超时、不加并发）**：`run-refresh.ts` 已支持 `REFRESH_PAGE_SIZE` 环境变量，但 workflow 未传入（默认 2）。若把 page-size 提到 25，40 条只需 2 次 search，可省掉 ≈17 次上游往返（本地 ≈28s；runner 上足以在 300s 内完成）→ **一行 workflow env 变更即可，属生产调度改动，需授权**。

## 5. 最小修改及测试结果

| 修改 | 文件 | 说明 |
| --- | --- | --- |
| 提示词补 6 条校验器不变量 | `scripts/ingest/deepseek-responses.ts` | ①永不输出 `required`（结构不可满足）②student_status 引文须含在校/已毕业词③minimum 须阿拉伯数字④education_minimum 须含「及以上/以上」⑤任何「优先」强制 preferred⑥branches 必须是引文子串、非 compound_or 必须 `[]`。**未改动任何校验规则**；`EXTRACTION_VERSION` 不变，因此不会触发既有 510 条重提取、不会产生额外模型调用。 |
| 阶段耗时汇总 | `scripts/ingest/run-job-pro.ts` | metrics 新增 `search_ms/detail_ms/upsert_ms`（纯数字，无敏感内容），随 `summary.json` 落到 Step Summary 归档。 |
| 回归测试 | `tests/ingest/deepseek-responses.test.ts`、`tests/ingest/gate-extraction.test.ts`、`tests/ingest/run-job-pro.test.ts` | ①提示词 6 条不变量 + 反向断言（不得出现 skip validation 之类）②用**真实子句**复现 4 个生产 code（`minimum_not_confirmed_by_quote`/`student_status_not_confirmed_by_quote`/`preferred_context_marked_mandatory`/`required_without_deterministic_confirmation`），并证明「按新提示词输出 metadata」可通过③阶段耗时被真实测量（dry-run 时 upsert_ms=0）。 |

结果：**536 项测试通过**（连续 2 次稳定）、lint 0 warning、typecheck 通过。

**失败岗位的 hash 与重试安全（Task A 第 5 点）**：`gate-extraction-store` 在调用前写入 `attempt_hash` 并由 RPC 回执校验（`value.attempt_hash === job.raw_content_hash`）；`refresh-pipeline.needsIncrementalExtraction` 对 `failed && attempt_hash === raw_content_hash` 直接跳过 → **本轮及后续自动运行都不会重试这 10 条**，无需额外保护。

## 6. 小米原有 2 条 campus 岗位状态变化（open → unknown）

**符合既有规则，不是回归。** `src/lib/domain/source-reliability.ts`：

- `:43` 每个可比较 run 先把状态重置为 `unknown`；
- `:60-63` 只有「**在本次 run 的 present 列表里**」才回到 `open`；
- `:64-67` 只有 `run.full_list && authoritative` 的缺席才累计 streak，且要**连续两次**才判 `closed`；
- `:68-69` 否则命中 `absence_not_proven`，保持 `unknown`，**永不判 closed**。
- 采集始终 `full_list: false`（`run-job-pro.ts:37`），所以缺席**永远**走 `:68-69`。

即：bounded 运行无法证明缺席，因此不能再声称「开放」，只能降为「开放状态未核实」（前端文案已明确「≠ 已关闭」）。这正是保守语义。

**需告知的运营后果**（非缺陷）：每次窄窗口刷新都会把**该来源未被本次覆盖的其他记录**从 `open` 降为 `unknown`。随扩量推进，同一来源的「开放」信号取决于最近一次是否覆盖到它。若希望维持 open 覆盖率，应按来源分轮次做**全量窗口**而非长期窄窗口。

## 7. 是否建议在下一批扩容前发布本轮修复

**建议发布。** 理由：

1. 修复是**纯提示词 + 观测**，不改校验器、不改 Gate/Evidence/Qualification、不改 `EXTRACTION_VERSION` → 不触发存量重提取、不产生付费调用；
2. 生产实锤：本批 10 次模型调用**全部**被拒（0% 成功率），而历史基线约 45%（Phase 1B：58 调用 26 成功）；根因 #1、#3 是**结构性必败**，不修则下一批仍会重复；
3. 修复后可把 #1（4 条）与 #3（2 条）转为可用的非阻断 metadata/ambiguous，预计模型实际成功率从 0% 回到 ~50-60%（保守估计，不承诺具体数字）；
4. 阶段耗时让下一次超时**可归因**（search vs detail vs upsert），避免再次靠猜。

**下一批扩容前建议同时决定**（均需另行授权，本轮未做）：① workflow 增加 `REFRESH_PAGE_SIZE` 传递（解决超时的最小改动）；② 是否把 10 条失败按新提示词重试一次（需授权，会新增 10 次模型调用）。

## 附：本轮边界

只读分析 + 本地测试；未触发生产 workflow、未 `--write`、未重试失败岗位、未调用付费模型、未改生产库、未 push/部署、未放宽任何冻结规则。分析产物在 gitignore 的 `.verification/product04/`。
