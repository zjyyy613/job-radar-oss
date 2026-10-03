# M0.5 Phase 1B — Batch Gate Extraction

日期：2026-10-03（Asia/Shanghai）。基于已验收 `b6a63a9`；M0 与 Phase 1A 冻结。

## 验收结论

**PASS，带明确质量限制：全部 396 待处理岗位已进入 pipeline；333 条新增成功，63 条安全失败并保持 Check。** 没有将失败伪装成 ready，也没有修改 parser、schema、prompt、Gate/Qualification semantics 或前端以提高通过率。

现有 404 source records / 404 jobs 不变。原有 8 条 successful extraction 的 job 全字段不变；所有 source_records/source_runs 快照不变。没有来源抓取、canonicalization 重跑、模型全量发送或 Actions/Deployment。

## Dry classification 与调用预算

| 分类 | 数量 |
|---|---:|
| total pending | 396 |
| parser-only | 307 |
| model fallback | 58 |
| parser 输出校验失败 | 31 |
| current successful skip | 8 |

分类在模型调用前完成并汇报。Fallback 为 pending 的 14.6%，不存在将所有 JD 交给模型的情况。31 条并非损坏数据库，而是冻结 parser 的结构输出无法通过冻结 validator，例如句首“或”产生空 OR 分支、unsupported metadata 与 preferred 标记不一致；保守失败，不绕过校验或临时改变规则。

使用已有服务端 `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL=deepseek-flash`，仅 `POST /responses`，原 schema/prompt 不变，仅发送 unresolved clauses。未记录、提交密钥。

本次 cap=116（58 首次调用 + 每条最多一次传输重试），实际 58；并发固定 1，首次请求前等待 350ms，传输/HTTP 5xx 最多重试一次，退避 1500ms，单次请求 90s timeout。结构/语义/证据无效不重试，HTTP 4xx 不重试。CLI 显式 cap 0–200，单批最多 500 jobs。

## 真实批次统计

| 指标 | 结果 |
|---|---:|
| parser-only success | 307 |
| model fallback jobs / actual calls | 58 / 58 |
| model success | 26 |
| model rejected（invalid_extraction） | 32 |
| parser validation failed | 31 |
| extraction failed 合计 | 63 |
| 新增 successful | 333 |
| ready jobs（含历史 8 条） | 341 |
| 新生成 gates | 377 |
| 全库 gates | 382 |
| average gates / successful new job | 1.132 |
| average gates / attempted new job | 0.952 |
| 全库 evidence quotes 自动验证 | 382 / 382 |
| 首末提取开始时间跨度 | 180.212s |

时间跨度包含模型/写库串行期间的运行时间，但不包含批次前快照与末次写库收尾，不作为精确端到端计费时长。63 条失败均保留既有结果（本轮新增岗位原本 gates=[]），数据库 extraction_status=failed；没有未处理记录被误判 Eligible。具体 IDs、失败类别及抽样见 metrics JSON。`invalid_extraction` 是现有 validator 的统一拒绝码，不将其全部谎称为 evidence mismatch。

## Evidence integrity 与语义抽查

写前复用独立 validateExtraction；现有 RPC 再次检查非空 quote 及 canonical 原文包含关系。写后对全部 382 条 evidence，逐一核对对应字段原文，并核对 linked source_records 的原始 payload 字符串；Li Auto HTML 源按 Phase 1A 既有 htmlText 解码后逐字匹配，无 paraphrase。0 不匹配。

Profile：在校 / 2027届 / 本科 / 机械工程；days_per_week、duration_months、research_areas 均未填写。Preferences 不参与资格判断。

| Verdict | 数量 |
|---|---:|
| Eligible | 239 |
| Check | 116 |
| Blocked | 49 |
| Excluded | 0 |

使用固定种子 `SHA-256(phase1b-audit:job_id)` 分层排序，各抽 10 条，共 30 条人工核对。结果与 gate/evidence 一致：

- Eligible：明确本科/在校条件满足；仅 title 27届 ambiguous/program 与 Profile 相符；三条 zero-gates 样本已 ready，JD 只有技能/经验或无法比较的完整专业列表 metadata，未凭未提取空数组通过。
- Check：抽样包括 extraction failure、未填写实习天数/月数、开放“相关专业”不能确定匹配，均与现有理由一致。
- Blocked：抽样均有明确硕士/博士条件与本科矛盾。蚂蚁岗位的每周4天/3个月“优先”仍为 preferred，阻断来自博士 required，未将 preferred 升级。

这些是冻结 M0 比较字段内的判断，Eligible 不表示满足 JD 中所有技能/经验条件；未为这轮扩量新增词表或规则。

## Checkpoint / resume / 失败重试

新增最薄 batch runner，复用 extractJob / validation / store RPC；checkpoint 不是第二套业务 readiness。

- 同一 checkpoint 将每次 HTTP 调用额度先落盘，结果在写库前落盘。原子 rename 保存；`.lock` 防止同一文件同时运行。
- SIGINT/SIGTERM 等待当前岗位完成后停止，不再启动下一条。强制退出的 started 标记视为 uncertain；不盲目重复可能已计费的请求，需核对 DB 后人工决定。
- store 响应不明确时停止批次；恢复先读真实数据库。若未写入则复用已保存结果，不重复模型调用。
- 原单条 runner 同 hash 跳过逻辑不变。显式 batch 可重试 failed/stale：条件 PATCH 比对 ID/hash/attempt/status/version/attempted_at，仅 reset attempt hash、标 failed/retry_pending；保留 gates 与最后成功 metadata，再用既有 RPC CAS 写入。未引入迁移或新状态表。
- 同批次已完成失败不在恢复时再次请求。针对失败的新尝试需要检查原因后显式新 checkpoint；不要换文件绕过预算。仅允许单 writer，不能并发启动其他 checkpoint 或旧 runner。
- 真实同 checkpoint rerun：341 successful skip + 63 checkpoint_done，调用前后均 58，没有额外模型调用。

## 404 jobs 浏览器 smoke

使用 production build、真实 Supabase 数据、上述验收 Profile，在隔离 Chrome context 验证；没有 mock 数据或 UI 改动。

| Surface | jobs | 首次加载观察 | 结果 |
|---|---:|---:|---|
| Desktop 1440×1000 | 404 | 2948ms | PASS |
| Mobile 390×844 | 404 | 2563ms | PASS |

验证完整列表、实际各状态数量、全列表资格优先顺序、腾讯搜索2条、地点过滤、排序 URL reload、Blocked Detail Peek / mobile full-screen 与 evidence；无 pageerror，无功能性 blocker。加载时间为单次本机观察，不是基准压测。smoke 初版修复了测试自身的 URL 异步等待和 HTML open 布尔属性判断；未改产品代码。

## Tests / 自审 / 文件范围

- lint PASS；typecheck PASS；20 test files / 337 tests PASS；production build PASS（Next.js 16.3.6）。
- 新测试覆盖 batch resume、successful skip、hash/version stale rerun、parser-only zero calls、串行 concurrency、重试调用 cap、模型无效 evidence 隔离、旧 gates 保留、partial restart、模型结果复用、缺失 hash 单岗位隔离。
- 原有 6 条 Spike 回归、24-case truth table、数据库失败保留/证据拒绝及 readiness tests 继续通过。
- 自审补强缺失 hash 不阻断下一岗位、cached result 必须匹配当前 hash 才能复用预算通道；恢复未再次调用模型。
- 修改范围：三个 batch orchestration/store/CLI 文件、batch tests、只读 browser smoke、README、报告/metrics。无运行时依赖，无 src/frontend/Gate/parser/schema/model prompt/SQL 改动。

## 后续限制（不在本轮实施）

1. 31 条 parser 输出与 validator 的兼容边界、32 条模型输出拒绝需要未来单独审计；本轮保持 failed/Check，不通过重试刷通过率。
2. 本地 checkpoint 依赖保留文件，强制退出的 uncertain 调用需要人工核对；不宣称跨机器 distributed exactly-once。
3. 不执行 Actions、schedule、deployment、新来源或 M1；当前 341 ready 是真实成功数，不承诺全部 404 ready。

[机器可读统计与30条抽样](2026-10-03-m05-phase1b-metrics.json)。本地完整快照/检查点/浏览器截图位于 ignored `.verification/phase1b/`，不进入生产引用。
