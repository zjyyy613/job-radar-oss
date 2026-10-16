# PRODUCT-04A 真实岗位来源扩量试点

> 只读试点：全部结论来自本地 dry-run（`--dry-run`，无任何写入）。基线为 2026-10-16 生产核对结果：**472 jobs / 473 source_records / 13 公司**。
> 本文区分三种状态：**① 上游已被抓到**（dry-run 通过）、**② 符合入库条件**（通过 `detailAdmission`）、**③ 已在生产库出现**（需数据库核对，本工作区无凭据，**未核实**）。

## 1. 实测验证了哪些来源

无新增适配器、未改来源白名单，只用既有 `@ha7ch/job-pro@1.2.1` 只读查询。

| 来源 | scope | 上游 total | 库内 | 本轮实测 |
| --- | --- | --- | --- | --- |
| **小米 xiaomi** | intern | **564** | 2 | **dry-run 2 页 ×25 = 50 候选：详情 50/50、准入 50/50、0 失败、72.1s** |
| **京东 jd** | intern | 102 | 50 | dry-run 4 页 ×25 = 100 候选：详情 100/100、准入 100/100、0 失败、101.2s |
| **美团 meituan** | intern | 364 | 60 | dry-run 4 页 ×25 = 100 候选：详情 100/100、准入 99/100（1 条 `insufficient_detail`）、100.5s |
| 网易 netease | intern=campus | 631 | 66 | 只读 total + 首页样本 |
| 阿里巴巴 alibaba | intern / campus | 625 / 462 | 50 | 只读 total + 首页样本 |
| OPPO | intern / campus | 97 / 145 | 50 | 只读 total + 首页样本 |
| 理想汽车 liauto | intern=campus | 1023 | 50 | 只读 total + 首页样本 |
| 蚂蚁集团 antgroup | intern=campus | 456 | 49 | 只读 total + 首页样本 |
| 快手 kuaishou | intern / campus | 228 / 475 | 49 | 只读 total + 首页样本 |
| **小鹏 xpeng**（未接入） | intern / campus | 82 / **631** | 0 | 只读样本：campus 首页即「智造专业培训生（涂装/总装/尺寸工艺）」 |
| **顺丰 sf**（未接入） | intern=campus | 150 | 0 | 只读样本：首页以科技岗为主 |
| **蔚来 nio**（未接入） | intern / campus | 436 / 437 | 0 | 只读样本：首页多为「蔚来顾问」类描述性标题 |
| 比亚迪 byd / 吉利 geely / 菜鸟 cainiao | social / all only | — | 0 | **不支持 campus/intern scope**，与本流水线不兼容 |

**建筑 / 土建 / 传统工程（施工类）**：该 CLI 覆盖的 50 家中**没有任何建筑、市政、电力建设类雇主**，因此现有官方来源能力**无法**补齐 `土建与测绘`（库内 0 条）。这需要**新增独立适配器**（另立任务），本轮不做。

## 2. 哪些来源真正有值得入库的增量

判断依据：库内覆盖窗口 + 真实准入率 + 职业方向价值。

**库内 ~50 条/源的来源窗口**：DATA-01 已确认它们来自 Phase 1A 的 `--limit 25 --max-pages 2 --max-jobs 50`，即**只覆盖前 50 个位次**；而每日 refresh 只抓 **intern、page 1、page-size 2**（见第 5 节）。所以**第 51 位次之后是未覆盖窗口**。

| 结论 | 来源 | 依据 |
| --- | --- | --- |
| **强（首批）** | **小米 intern** | 库内仅 2 条（且属 campus 时代），上游 intern 564；50/50 准入、0 失败；候选含工程与制造 13%、金融 8%、人力 8%（补库内薄弱方向） |
| **强（第二批）** | **京东 intern 第 51–100 位** | 与已覆盖窗口 **ID 重叠 0**；100/100 准入；候选含**机械工程师、电气工程师、设备维养、供应链运营/规划、财务结算** |
| **中** | 美团 intern 第 51–100 位 | 重叠 0、99% 准入；但该窗口 **人力 20%**，方向价值一般 |
| **中（需 scope 支持）** | **小鹏 campus** | 样本 **工程与制造 55%（工艺与质量 9/20）**，直击库内 `工艺与质量` 仅 4 条的缺口；但 campus 不进现有流水线 |
| **弱（不建议本轮）** | 顺丰 intern、蔚来 intern | 样本分别 75% 技术研发 / 50% 未分类，方向增益低 |
| **不可用** | byd / geely / cainiao | 只有 social/all scope |

## 3. 各来源候选 / 准入 / 去重 / 预计净新增

| 来源窗口 | 抓到（unique） | 详情成功 | 准入通过 | 运行内重复 | **预计净新增** |
| --- | --- | --- | --- | --- | --- |
| 小米 intern 1–50 | 50 | 50 | **50 (100%)** | 0 | **50**（库内 2 条为 campus，intern 池不同）→ 首批取 1–40 |
| 京东 intern 1–100 | 100 | 100 | **100 (100%)** | 0 | 窗口 51–100 共 **50 条**（与 1–50 重叠 0，**待 DB 核验**） |
| 美团 intern 1–100 | 99 | 100 | **99 (99%)** | 0 | 窗口 51–100 共 **49 条**（重叠 0，**待 DB 核验**） |

**去重能力**：运行内按 `post_id` 去重（`seen` 集合，本轮 0 重复）；跨运行/跨库去重由 `source_records (source, source_job_id)` 唯一键 + `upsertRecord` 完成，写入时会返回 `inserted / updated / unchanged`——**只有真实 `--write` 运行才能给出确切净新增**，本轮为估算并已标注。

## 4. 新岗位主要补充哪些职位类别

用**已发布的 `job-category-v1`** 对候选标题归类（与 Radar UI 同一套规则）：

| 候选集 | 一级分布 | 补充的方向 |
| --- | --- | --- |
| 小米 intern（75 样本） | 技术研发 33%、**工程与制造 13%**、运营 11%、产品 11%、人力 8%、**金融与财务 8%**、其他 12% | 工程与制造 35→45、金融与财务 13→19（占库比 2.8%→3.5%） |
| 京东 intern 51–100 | 技术研发 36%、运营 18%、**工程与制造 8%**、市场 6%、金融 4%、其他 **26%** | 机械与结构、电气与电子、供应链采购、财务 |
| 美团 intern 51–100 | 技术研发 30%、**人力 20%**、产品 18%、运营 14% | 人力与行政、产品 |
| 小鹏 campus（20 样本） | **工程与制造 55%**（**工艺与质量 9**） | 工艺与质量 4→13，汽车与整车 7→9（最强方向增益） |

**同时暴露分类器覆盖不足**：京东深层窗口 **26%（13/50）落入「其他>未分类」**，典型如 `工程技术`、`设备维养工程师`、`园区经理（物业方向）`、`损耗控制`、`安全支持`、`基层管理储备`、`核保`、`医务`。按本轮边界**未改分类规则**，仅作为后续任务登记（建议：设备/设施维养 → 工程与制造，物业/园区 → 行政，医疗健康需新增一级）。

## 5. 是否发现真实的工程阻断

| # | 发现 | 严重度 | 处理 |
| --- | --- | --- | --- |
| 1 | **全量 batch CLI 在岗位表 >500 时直接失败**：`run-batch-gate-extraction.ts` 把**整张 jobs 表**交给 `runBatch`，而 `runBatch` 对 `jobs.length > 500` 抛 `Invalid batch budget`。当前 472 条 → **仅剩 28 条余量**，扩容 30 条即触发 | **高（本轮已修）** | 新增 `selectBatchJobs`（只取仍需提取的岗位），CLI 改为提交 `pending`；`runBatch` 的 500 守卫保留并新增测试 |
| 2 | **canonicalization 快照硬上限**：`source_records > 1000` 或 `source_runs > 10000` 时 RPC **raise exception**（非静默截断，安全）。当前 473 → 余量 527 | 中（本批不触发） | 需决策：提高上限或改增量快照；**本轮未改** |
| 3 | **refresh 流水线 scope 硬编码 intern**：`run-refresh.ts` 固定 `--scope intern`，因此 campus-only 的岗位池（小鹏智造/工艺 631、京东 campus 245、小米 campus 792）**无法通过调度路径入库** | 中 | 方案：手工 `--write`（无需改代码）或新增 `REFRESH_SCOPE`（**需授权**，默认值不变则无行为风险） |
| 4 | **page size 不是 workflow 输入**（`REFRESH_PAGE_SIZE` 默认 2），workflow_dispatch 只能调 `max_pages`，因此**深层位次窗口**（如京东 51–100）无法在一次审计运行内直达 | 低 | 手工 `run-job-pro.ts --write --limit 25 --max-pages 4`，或新增一个 workflow 输入（**需授权**） |
| 5 | `published_at` 仍近乎全空：新候选样本 `post_date` 均为 `none`（适配器只接受带时区的时间戳） | 低（既有已知） | 不改；`新鲜度` 依赖 `fetched_at`，前端已如此呈现 |
| 6 | 分类器对物流/物业/维修/医疗类标题覆盖不足（京东深层 26% 未分类） | 低 | 登记为后续任务，本轮不改分类 |

**扩容风险审查（逐项）**

1. **每日额度与白名单**：cron `17 23 * * *`；8 源（alibaba,meituan,jd,netease,kuaishou,oppo,liauto,antgroup）；`intern`；page-size 2 / max-pages 1 / max-jobs 2 / global 16 / model cap 8；workflow `timeout-minutes: 45`；支持 `workflow_dispatch` 覆盖 sources/max_jobs/max_pages/global_cap/model_cap。
2. **增量提取只处理 pending**：✅ `refresh-pipeline.ts` 用 `needsIncrementalExtraction` 过滤后调用 `runBatch`。
3. **runBatch 的 500 限制何时触发**：仅当传入列表 >500；每日路径传 pending（很小），手工全量 CLI 原传全表（→ 见发现 1）。
4. **全量 batch CLI 超 500 的行为**：抛错且不处理任何岗位（进程退出码 1，无部分写入）——已修。
5. **canonicalization 1000/10000**：硬 raise（见发现 2）。
6. **断点/去重/预算/部分失败**：checkpoint + `writer.lock`、`started` 状态**不盲目重试**（`uncertain_interrupted`）、`max_calls ≤ 200` 且每次 HTTP 前记账、`source_records` 唯一键 + canonical 身份去重、`refresh-report` 输出 Step Summary/annotation（只有 `failed` 非零退出）。
7. **对分类与 Qualification 的影响**：新增岗位走同一套 `job-category-v1` 与 gate 提取；`internship_type`/`recruitment_batch` 在适配器内固定为 `null`（既有已知），不新增字段、不改 Gate/Evidence/Qualification。

## 6. 必要代码修改及测试结果

**唯一修改**（最小修复发现 1）：

- `scripts/ingest/batch-gate-extraction.ts`：新增 `selectBatchJobs(jobs)`（过滤掉 `classify === 'skip'`）。
- `scripts/ingest/run-batch-gate-extraction.ts`：先打印全表分类（可见性不变），再**只把 pending 交给 `runBatch`**；输出新增 `pending` 字段。
- `tests/ingest/batch-gate-extraction.test.ts`：新增 2 个测试——①只携带仍需处理的岗位（含 501 条 ready 表 → 选择结果为空）；②`runBatch` 对 >500 仍抛 `Invalid batch budget`（守卫不被削弱）。

结果：`tests/ingest/batch-gate-extraction.test.ts` **10 通过**；全量 **533 通过 / 28 文件**；lint 0 warning；typecheck 通过。

## 7. 建议首批生产扩容量与模型预算

**首批（推荐，零代码/零 workflow 改动即执行）**：小米 intern 位次 1–40。

- 依据：库内仅 2 条、上游 564、实测 100% 准入、方向增益（工程与制造/金融/人力）。
- 量：**40 条候选**（落在 30–50 目标区间）。
- 耗时：≈1.4s/条 → **约 1 分钟**（远低于 45 分钟上限）。
- **模型调用预算**：以 Phase 1B 实测比率为基准（**58 次 DeepSeek 调用 / 396 条 pending ≈ 0.15 次/条**），40 条 ≈ **6 次调用**；预留余量建议 `model_cap=20`。
- 失败面：dry-run 该窗口 0 失败；若上游限流，`readWithRetry` 仅对网络/5xx 重试一次，遇 429/403 立即停止并保留 checkpoint。

**第二批（需授权）**：小鹏 campus 位次 1–25（补 `工艺与质量`/`汽车与整车`）——需先支持 campus scope；第三批：京东/美团 intern 第 51–100 位（需 page-size 或两次运行）。三批合计 ≈ 115 条，约 18 次模型调用。

### 7.1 执行前预检（按生产 workflow 的真实分页参数）

```
node --import tsx scripts/ingest/run-job-pro.ts --dry-run --sources xiaomi --scope intern --limit 2 --max-pages 20 --max-jobs 40 --global-max-jobs 40
```

结果：**status success / 20 页 / listed 40 / unique 40（重复 0）/ 详情 40/40 / 准入 40/40 / 拒绝 0 / 失败原因 {} / stop_reason=max_jobs / 89.7s**。

- **与 PRODUCT-04A 已验证样本的重合**：40 条**全部**落在 04A 的 75 条小米样本内，且**恰好是位次 1–40、顺序完全一致**（`新40 ∩ 旧前40 = 40/40`，`不在旧样本内 = 0`）；本轮**未出现上游顺序漂移**。这不代表未来运行必然相同——执行时仍应以当次 `mapped_ids` 为准。
- **`max_jobs` 缺失的后果已被代码验证**：`max_jobs` 默认 2 时，`pageSize = min(limit, 50, maxJobs, …) = 2`，第 1 页取满 2 条后即 `metrics.listed >= maxJobs` → `stop_reason=max_jobs`，**只写入 2 条**。因此生产命令必须显式带 `max_jobs=40`。
- 成本复核：40 条 / 89.7s ≈ **2.2s/条**（含 20 次 search + 40 次 detail）；模型调用仍按 0.15 次/条估算 ≈ **6 次**。

## 8. 最小可执行的生产写入、核对与失败回退方案

**写入（Route A，推荐；使用既有审计路径，不改调度、不改 Secrets）**

```
gh workflow run refresh.yml \
  --ref task-1-m0-contracts \
  -f sources=xiaomi -f max_jobs=40 -f max_pages=20 -f global_cap=40 -f model_cap=20
```

- **必须显式 `--ref task-1-m0-contracts`**：否则 GitHub 默认在仓库默认分支上取 workflow 定义，可能执行到与审核版本不同的代码。
- **必须显式 `max_jobs=40`**：该 workflow 输入默认值只有 2（见 workflow `REFRESH_MAX_JOBS`），缺省会只抓 2 条（第 7.1 节已用代码路径与 dry-run 双重确认）。
- 效果：intern、page-size 2 × 20 页 = 小米位次 1–40；写入 `source_records` → canonicalize → 仅提取 pending（≤40 条）→ 生成 `summary.json` 与 Step Summary。
- 不改：cron、来源白名单默认值、Secrets、Qualification/Gate/Evidence、分类规则。

**写入前基线（必须先记录，用于事后核对）**

`summary.json` 自带 `baseline: {records, jobs, ready}`（运行开始时快照），因此**无需额外写操作**；另建议在执行前只读记录一份该来源的 ID 基线：

```sql
select count(*) from public.source_records where source = 'job-pro:xiaomi';          -- 基线条数
select source_job_id from public.source_records where source = 'job-pro:xiaomi';    -- 基线 ID 集合
select count(*) from public.jobs;                                                   -- 基线岗位数
```

**核对（写入后按顺序）**

1. `summary.json`：`inserted / updated / unchanged`（真实净新增）、`detail_success / admitted`、`extraction_pending`、`parser_only` 与 `model_calls`、`ready_jobs`、`evidence_quotes_verified`、`application_status` 分布。
2. ID 差集（唯一可靠的"本批新增"口径）：`事后 ID 集合 − 写入前 ID 集合`。
3. 分类影响：`/radar` 默认总数应 +（净新增），类别计数里**工程与制造 / 金融与财务 / 人力与行政**应有增量，`其他>未分类` 增量与第 4 节预测量级一致（小米样本约 12%）。
4. 抽 3 条新岗位打开详情：确认 JD、官方申请链接（`xiaomi.jobs.f.mioffice.cn` 且含 post_id）、地点可辨认。

**失败处理（修正后）**

- **PARTIAL 可能以退出码 0 结束**（`refresh-report.ts` 明确：只有 `failed` 非零；PARTIAL 通过 Step Summary 与 Actions warning 提示）。**不得只凭 Actions 绿色认定成功**，必须读 `summary.json` 与 Step Summary 中的 PARTIAL 段落。
- 运行中/失败时：**保留 checkpoint 与 summary 原样**（workflow 已归档 `refresh-checkpoint` artifact）。
- 随后**只做只读核对**（上述第 1–4 项），**不自动删除、不盲目重跑**。盲目重跑会把"疑似已写入"的记录再次 merge，覆盖其 `fetched_at/last_seen_at/raw_hash`，掩盖现场。
- 若确需回退：**不能按 `source + fetched_at` 删除**。`upsertRecord` 是 `on_conflict=source,source_job_id` 的 **merge-duplicates**：本批中被重新抓到的**既有**记录也会把 `fetched_at/last_seen_at` 刷新为本次时间戳，按时间戳删除会连带删掉原本存在的记录（真实数据丢失）。正确口径是**按写入前记录的 ID 差集**精确删除 `source_job_id`，然后重新触发一次 refresh 让 canonicalize 收敛（`apply_canonicalization` 会按计划移除不再存在的岗位）。该删除属生产写操作，**需单独授权**。
- 预算耗尽时 `budget_deferred` 不写错误结果，checkpoint 保留，可用 `workflow_dispatch` 调大 `model_cap` 续跑。

## 附：本轮边界遵守

未写入生产库、未使用 `--write`、未触发/修改任何 workflow 或 Secrets、未 push/部署、未绕过验证码或站点限制、未批量调用付费模型（dry-run 不调用模型）、未改 Qualification/Gate/Evidence、未改分类规则与筛选 UI。所有分析脚本与原始产物位于被忽略的 `.verification/product04/`（未提交）。
