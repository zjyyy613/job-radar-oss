# AUTOMATION-01 自主扩容审查工作流 v1

> 目标：把「候选 dry-run → 准入 → 去重 → 分类 → 人工审查 → 授权 → 生产 → 核验」中**确定性的判断**自动化，不建设新平台。
> 基线提交：`e5724ba`（生产 568 条 / 14 家雇主）。本轮**未 push、未部署、未写生产库、未触发生产 workflow、未调用任何模型**。

## 1. 交付物

| 交付 | 位置 |
| --- | --- |
| 候选审查工作流（只读） | `.github/workflows/candidate-audit.yml` |
| 候选审查引擎（规则 + CLI） | `scripts/ingest/candidate-audit.ts` |
| 生产结果核验引擎（复用 summary/checkpoint） | `scripts/ingest/refresh-audit.ts` |
| 生产 refresh 最小增强 | `.github/workflows/refresh.yml`（新增审计步骤 + 报告归档，`continue-on-error`，不影响运行判定） |
| 真实 dry-run 审查报告 | [candidate-audit-xpeng-page2.md](candidate-audit-xpeng-page2.md) / `.json` |
| 基于既有运行证据的结果报告 | [refresh-audit-xiaomi-04b.md](refresh-audit-xiaomi-04b.md) / `.json` |
| 历史运行 fixture | `tests/fixtures/refresh/xiaomi-04b-partial.json` + `…-checkpoint.json` |
| 回归测试 | `tests/ingest/candidate-audit.test.ts`（12）、`tests/ingest/refresh-audit.test.ts`（8） |

## 2. A. 扩容前自动审查

`candidate-audit.yml` 手动触发，输入 `sources / scope / start_page / page_size / max_pages / max_jobs / global_cap`，执行：

```
node --import tsx scripts/ingest/candidate-audit.ts --sources … --scope … --start-page … \
  --page-size … --max-pages … --max-jobs … --global-max-jobs … --out .verification/audit
```

**复用而非重写**：`run-job-pro.parseOptions`（全部边界校验）+ `runIngestion`（真实采集循环、`detailAdmission`、去重、计时）。唯一的替换是**存储层注入 collector**（`upsertRecord` 只收集记录、`writeRun` 只收集运行），因此**没有任何写入路径**；代码路径与生产完全一致，准入结论可信。

输出（Markdown + JSON 双份）：

- 候选数量、唯一 `source_job_id`、运行内重复 ID；
- 详情尝试/成功/准入/拒绝 + 准入率；
- 官方 URL 检查（host 是否等于该来源 `upstream`、URL 是否携带自身 id）、地点非空、JD 字符数；
- 一级/二级类别分布（`job-category-v1`，零模型调用）；
- 「其他/未分类」数量与比例；
- 分页窗口校验（`page_size × max_pages` vs `max_jobs`、`start_page + max_pages − 1 ≤ 20`）；
- 阶段耗时（search/detail/upsert）、每条耗时、按满额推算的耗时与 300s 预算之比；
- 候选完整清单（id/公司/标题/地点/类别/申请链接）；
- **PASS / REVIEW / STOP + 逐条原因码**。

### 判定规则（固定阈值，可测试）

| 严重度 | 触发条件（代码） |
| --- | --- |
| **STOP** | 来源不在白名单 `invalid_sources`；窗口越界 `window_out_of_range`；来源级失败 `fatal_source_failure`（`access_denied`/`rate_limited`/`source_timeout`/`challenge_page`/`unreadable_detail`/`untrusted_locator`/`missing_location`/`search_failed`/`repeated_page`）；`no_admitted_candidates`；实测速度推算超预算 `projected_timeout` |
| **REVIEW** | 未做生产去重 `production_dedup_unverified`（**本工作流无 DB 凭据，因此常态命中**）；未分类 ≥30% `unclassified_heavy`；有候选被拒 `rejected_candidates`；重复 ID `duplicate_ids`；标题含「正式/社招」`mixed_recruit_signals`；链接非官方或未带 id `unofficial_locator`；JD <80 字符 `thin_jd`；`page_size×max_pages < max_jobs` `window_under_budget`；耗时占预算 80–100% `timeout_risk`；非预期停止原因 `unexpected_stop_reason` |
| **PASS** | 以上均不触发 |

**PASS 的硬前提是已完成生产只读去重**。本工作流刻意为**零数据库凭据**（`permissions: contents: read`，无 `secrets.` 引用），所以它的上限是 **REVIEW**；报告固定输出「净新增：未确认」。这是设计取舍：**不允许用可写 service role 伪装只读**。

## 3. B. 扩容后自动核验

`refresh-audit.ts --summary <summary.json> [--checkpoint <checkpoint.json>]`，纯函数 `summarizeRefresh()` 便于测试。整理：

- 运行前基线（`baseline.records/jobs/ready`）与 `inserted/updated/unchanged`、`canonical_new/changed`；
- 资格提取：`pending/parser_only/success/failure/deferred`、`ready_jobs`、证据引文校验数；
- 模型调用量与 checkpoint `max_calls` 的比值；
- 失败诊断按来源聚合（`failure_reasons`）+ 逐条提取诊断（失败优先）；
- 分来源耗时（search/detail/upsert/duration）与 `stop_reason`；
- 最终内部状态 `SUCCESS/PARTIAL/FAILED`，并**同时显示流水线的退出码**——明确写出「PARTIAL 退出码仍为 0，不要仅凭 Actions 绿色判定成功」；
- 需要人工处理的异常清单（超时、访问被拒、提取失败**禁止无授权重试**、延后、缺 summary）。

Markdown 直接**复用既有 `buildRefreshReport(summary)`** 的 Step Summary 原文，避免第二套口径。

`refresh.yml` 只在末尾新增两个 `if: always()` 步骤（生成报告 + 写入 Step Summary）并把报告并入既有 artifact；审计步骤 `continue-on-error: true`，**不会改变**运行本身的判定。采集逻辑未改动一行。

## 4. 真实案例验证（本轮实跑）

### 4.1 小鹏 intern 第 2 页（真实只读 dry-run）

`--sources xpeng --scope intern --start-page 2 --page-size 25 --max-pages 1 --max-jobs 25 --global-max-jobs 25`

| 项 | 结果 |
| --- | --- |
| 结论 | **REVIEW** |
| 候选 / 唯一 ID / 重复 | 24 / 24 / 0 |
| 详情 / 准入 | 25 尝试、25 成功、**24 准入（96%）**、1 拒绝（`insufficient_detail`） |
| 未分类 | **12（50.0%）** → 触发 `unclassified_heavy` |
| 耗时 | 75.1s（search 4.1s / detail 71.0s），3131ms/条，满额预计 78s / 300s = 26% |
| 净新增 | **未确认**（`production_dedup_unverified`） |

> 该 1 条被拒正是上一轮发现的 `压铸顶岗实习生`（JD 仅 "--"）——审计独立复现了同一结论。

### 4.2 历史生产运行核验（小米首批 38 条，证据来自已记录的运行指标）

| 项 | 结果 |
| --- | --- |
| 内部状态 / 结论 / 退出码 | **PARTIAL** / **REVIEW** / **0** |
| 基线 → inserted | 473 / 472 / 414 → **+38** |
| 提取 | 28 成功 / **10 失败** / 0 延后；ready 34 |
| 模型 | 10 / 20（50%） |
| 耗时与停止原因 | 303.1s，`source_timeout`（search 41.2s / detail 248.9s / upsert 12.9s） |
| 人工处理 | 明确要求：不得仅凭 Actions 绿色判成功；10 条失败**不得无授权重试模型**；超时需另开批次 |

> 该报告由真实 `summary.json` 结构驱动；因本地无该次 artifact，fixture 依据已记录的运行指标（472→510、38、28/10、10 次调用、303114ms、`source_timeout`）重建，并在 fixture 内以 `_note` 标注。

## 5. 关键回归（对应验收要求）

| 要求 | 测试 |
| --- | --- |
| 净新增不能用候选数代替 | `never reaches PASS without production de-duplication…`：断言 `net_new.confirmed === false`、`candidates` 与净新增分离；refresh 侧 `reports the real net new from inserts` |
| 部分提取失败必须显示 PARTIAL | `surfaces PARTIAL and never treats the green Actions result as success`（断言 exit_code 0 + 文案） |
| 分类未覆盖较多时提示人工 | `raises REVIEW when the classifier cannot place enough candidates`（≥30% → `unclassified_heavy`） |
| 不得因旧失败岗位自动重复调用模型 | `lists extraction failures…forbids unauthorised retries`（10 条诊断 + 「不得无授权重试模型」） |
| 不能仅凭退出码 0 判断成功 | 同上两条（exit_code 与 verdict 分离） |
| STOP 场景 | `access_denied/rate_limited/source_timeout/challenge_page` 四例、零准入、窗口越界、预计超时 |
| 其他 REVIEW 场景 | 被拒候选、招聘类型混入、JD 过薄、预算窗口不足、非官方链接 |

**测试：574 通过**（554 + 20）；lint 0 warning；typecheck 通过。

## 6. 是否可只通过一次 GitHub Actions 完成候选核查

**可以，且不需要任何凭据**：

1. Actions → **Candidate Audit (read-only)** → Run workflow；
2. 填 `sources`（白名单内，如 `xpeng`）、`scope`、`start_page/page_size/max_pages/max_jobs/global_cap`；
3. 运行结束后在 **Step Summary** 直接读结论，或下载 `candidate-audit` artifact（`audit.md` + `audit.json`）；
4. `STOP` 时该步骤以非零退出（作业显示失败）并照常上传报告——不会被误认为通过。

**仍需人工的一步**：`production_dedup_unverified` 决定了结论上限为 REVIEW。要得到 PASS，必须在**具备只读凭据**的环境（例如本地 `.env.local` 或单独的只读 job）比对 `source_records` 的 ID 差集；本工作流刻意不具备该能力。

## 7. 安全边界落实

- 生产写入仍需人工批准；工作流**无 DB 凭据、无 `secrets.`、`permissions: contents: read`**；
- 不自动触发扩容、不删数据、不重试提取、不改 Gate/Evidence/Qualification、不改分类规则、不改来源/Secrets/cron/生产分支；
- 报告只含 `source_job_id`、标题、地点、官方链接与类别，不含密钥、模型原文或敏感字段；
- `refresh.yml` 仅追加报告步骤，采集逻辑零改动。

## 8. 已知限制

1. **去重未自动核实**（无只读凭据）→ 结论上限 REVIEW；
2. 招聘类型只能由 scope 与标题推断（`SourceRecord` 不保留上游 `recruit_label`），因此用 `mixed_recruit_signals` 提示人工确认，而非断言；
3. 耗时推算基于本次实测均值，上游抖动会改变 `timeout_risk`；
4. 生产结果核验依赖 `summary.json` 保留；缺失时报告会明确提示（`summary 中缺少 source_runs`）。
