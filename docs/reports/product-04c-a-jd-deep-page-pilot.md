# PRODUCT-04C-A 京东深层岗位定向采集（start_page 最小能力 + 只读 dry-run）

> 只读试点：全部数据来自本地 `--dry-run`（无任何写入）。生产库现状：518 条岗位，其中京东 50 条（ChatGPT 独立核查）。
> **未执行生产写入、未触发 Actions、未调用付费模型、未改分类规则与 UI。本工作区无生产库凭据，因此「与生产库 ID 去重」未核实——只交付候选 ID 清单供独立比对。**

## 1. 最小代码修改

| 文件 | 改动 |
| --- | --- |
| `scripts/ingest/run-job-pro.ts` | `RunOptions.startPage?`；`bounds()` 校验 `startPage`（1–20）与 **`startPage + maxPages − 1 ≤ 20`**；循环从 `startPage` 起、到 `startPage + maxPages − 1` 止；`parseOptions` 新增 `--start-page`（默认 1）；错误提示同步 |
| `scripts/ingest/run-refresh.ts` | 传入 `--start-page ${REFRESH_START_PAGE ?? '1'}`；导出 `sameWindowOptions()` 做**逐字段**窗口比对（缺失的 `startPage` 视为 1，其余窗口变化仍拒绝续跑） |
| `.github/workflows/refresh.yml` | `workflow_dispatch.inputs.start_page`（number，默认 **1**）→ `REFRESH_START_PAGE: ${{ inputs.start_page \|\| '1' }}` |
| `tests/ingest/refresh-workflow.test.ts`、`tests/ingest/run-job-pro.test.ts` | 新增 7 项 start_page 回归 + 既有断言补充 `startPage: 1` |

**未改动**：page_size 语义、5 分钟单来源超时、并发度、来源白名单、cron、模型预算、`permissions`、DB 字段、分类规则、UI。**没有用 page_size 冒充起始页**：`startPage` 直接决定 `--page`，不做偏移换算。

## 2. 自动测试 / lint / typecheck

- **550 项测试通过**（连续 2 次稳定）；本轮新增 7 项；
- **lint 0 warning**；**typecheck 通过**。

覆盖的 8 项要求：

| # | 要求 | 证据 |
| --- | --- | --- |
| 1 | start_page=3 只请求第 3 页 | 记录 CLI 调用，断言 `pages == [3]`（**第 1、2 页从未被请求**）、`pages_fetched=1` |
| 2 | 25 条按现有标准验证/去重/准入 | `detail_attempted=25`、`admission_passed=25`；`seen` 集合去重；实测 25/25 |
| 3 | 默认 start_page=1，定时不变 | `parseOptions(["--write"]).startPage === 1`；schedule 无 inputs → `\|\| '1'`；脚本内 `??'1'` 兜底 |
| 4 | 保留页数/岗位数/全局预算/白名单 | 原有 4 项上限校验未改；`parseOptions` 拒绝 `--start-page 0/21` 与非白名单来源 |
| 5 | 起始页 + max_pages 不越界 | `startPage 15 + maxPages 10 → 24 > 20` 抛 `Start page and page budget exceed the page range` |
| 6 | query_exhausted / repeated_page / max_jobs / 续跑 | 各有专项用例（起始页超出末尾、重复页、预算先到、checkpoint 窗口比对） |
| 7 | checkpoint 记录起始页、变更不得错误续跑 | `sameWindowOptions` 逐字段比较；`startPage 3 ≠ 1` 拒绝；旧 checkpoint 缺该字段仍按 1 续跑 |
| 8 | `records_seen` 反映实际处理数 | 实测 `records_seen=25`（不是 75），测试同样断言 |

## 3. 只读实测（京东 intern 第 3 页）

命令：

```
node --import tsx scripts/ingest/run-job-pro.ts --dry-run --sources jd --scope intern \
  --limit 25 --max-pages 1 --start-page 3 --max-jobs 25 --global-max-jobs 25
```

| 指标 | 结果 |
| --- | --- |
| 上游 total（今日） | **102**（与 PRODUCT-04A 一致 → 上游无变化） |
| pages_fetched / listed / records_seen | **1 / 25 / 25** |
| unique source_job_id | **25（重复 0）** |
| 详情成功 / 准入通过 | **25/25 / 25/25**（拒绝 0，failure_reasons `{}`） |
| stop_reason | `max_jobs`（max_jobs = page_size，预算先到） |
| 阶段耗时 | search **3,355ms**(12.8%) / detail **22,890ms**(87.2%) / 合计 **26,256ms** |
| 上游异常 | 无；未出现限流、验证码或异常响应 |

**与 PRODUCT-04A 旧快照的独立复核（关键）**：

- 新 25 条 ∩ 旧「已覆盖前 50 位」= **0/25** → **确认未重复抓取已覆盖窗口**（旧结论重新核实成立）；
- 新 25 条 ∩ 旧「第 3 页切片」= **25/25**，且顺序完全一致 → 4 天内**上游顺序稳定、无漂移**；
- 新 25 条中不在旧快照内的 = **0**；
- 25 条与「实时 page-3 search」的 ID 完全一致（`identical: true`）。

**JD 质量抽样**（3 条）：

| id | 标题 | 地点 | 职责 | 要求 | 申请链接 |
| --- | --- | --- | --- | --- | --- |
| 9142 | 渠道销售 | 北京市-北京市 | 290ch | 294ch | `campus.jd.com`（含 id） |
| 6736 | 算法工程师-搜索/推荐/广告 | 北京市-北京市 | 316ch | 454ch | 同上 |
| 4998 | 工程技术 | 北京市-北京市 | 161ch | 212ch | 同上 |

全部通过准入硬条件（官方域名、URL 含 `source_job_id`、地点非占位、有效正文 ≥80 字符）。`post_date` 均为 `none` → `published_at` 仍为空（既有已知限制，非本轮引入）。

## 4. 25 条候选 source_job_id 清单（供生产库独立比对）

| # | source_job_id | 标题 | 地点 |
| --- | --- | --- | --- |
| 1 | 9142 | 渠道销售 | 北京市-北京市 |
| 2 | 9140 | 营销运营 | 北京市-北京市 / 上海市-上海市 / 广东省-深圳市 |
| 3 | 4856 | 测试开发工程师 | 北京市-北京市 / 天津市-天津市 |
| 4 | 4908 | 技术运维工程师 | 北京市-北京市 / 山西省-大同市 |
| 5 | 9132 | 项目与流程管理 | 广东省-广州市 / 福建省-厦门市 / 北京市-北京市 |
| 6 | 4906 | 安全工程师 | 北京市-北京市 / 广东省-深圳市 |
| 7 | 5031 | 门店运营（健康） | 北京市-北京市 / 江苏省-泰州市 |
| 8 | 6736 | 算法工程师-搜索/推荐/广告 | 北京市-北京市 |
| 9 | 6667 | 算法工程师-具身智能 | 广东省-深圳市 / 北京市-北京市 / 上海市-上海市 |
| 10 | 6746 | 医务 | 北京市-北京市 |
| 11 | 4904 | 算法工程师-数据挖掘 | 北京市-北京市 / 上海市-上海市 / 广东省-深圳市 |
| 12 | 5029 | 医生运营（健康） | 北京市-北京市 |
| 13 | 4902 | 数据应用工程师 | 北京市-北京市 |
| 14 | 5897 | 数据开发工程师 | 北京市-北京市 / 天津市-天津市 / 四川省-成都市 |
| 15 | 5017 | 核保 | 北京市-北京市 |
| 16 | 4896 | 算法工程师-AI Infra | 北京市-北京市 / 广东省-深圳市 |
| 17 | 4894 | 算法工程师-运筹优化 | 北京市-北京市 |
| 18 | 4892 | 算法工程师-视觉算法与数据交付 | 广东省-深圳市 / 北京市-北京市 |
| 19 | 4888 | 算法工程师-机器学习 | 北京市-北京市 / 上海市-上海市 / 广东省-深圳市 / 天津市-天津市 |
| 20 | 4890 | 算法工程师-自动驾驶 | 广东省-深圳市 / 北京市-北京市 |
| 21 | 4998 | 工程技术 | 北京市-北京市 |
| 22 | 4982 | 资金管理 | 北京市-北京市 |
| 23 | 4884 | 算法工程师-多模态大模型 | 北京市-北京市 / 上海市-上海市 / 广东省-深圳市 |
| 24 | 4882 | 硬件测试工程师 | 北京市-北京市 |
| 25 | 4878 | 嵌入式技术工程师 | 北京市-北京市 / 广东省-深圳市 |

比对口径：`select source_job_id from public.source_records where source = 'job-pro:jd';` 与上表取差集。**本工作区未连库，未做该比对，也不声称已去重。**

## 5. 分类增益（job-category-v1，未改规则）

| 一级 | 本批新增 | 占比 | 基线 472 → 加入后 |
| --- | --- | --- | --- |
| 技术研发 | **+14** | 56.0% | 193 → 207 |
| 运营 | +3 | 12.0% | 69 → 72 |
| 工程与制造 | +1 | 4.0% | 35 → 36 |
| 市场与商务 | +1 | 4.0% | 32 → 33 |
| **其他（未分类）** | **+6** | **24.0%** | 2 → 8 |

二级：算法与AI 8、软件开发 4、业务与策略运营 3、测试与质量 1、安全与隐私 1、电气与电子 1（硬件测试工程师）、商务拓展与销售 1、未分类 6。

**「其他/未分类」6 条的原因**（与 PRODUCT-04A 记录的歧义一致，本轮**只统计、不改分类器**）：

| id | 标题 | 原因 | 性质 |
| --- | --- | --- | --- |
| 9132 | 项目与流程管理 | 不含「项目管理」字面（「项目与流程管理」），落入兜底 | 分类器缺口（可修） |
| 4902 | 数据应用工程师 | 不含「开发/数据工程/数据分析」等词 | 分类器缺口（可修） |
| 4982 | 资金管理 | 「资金」不在金融财务词表 | 分类器缺口（可修） |
| 5017 | 核保 | 保险类岗位，词表只有「保险」 | 分类器缺口（可修） |
| 6746 | 医务 | 无医疗健康一级类目 | 体系缺口（需新增一级，超出本轮） |
| 4998 | 工程技术 | 京东内部岗位族名，语义过泛 | 真实歧义（需 JD 核实） |

批量内**无重复标题**；`测试开发工程师`、`数据开发工程师` 两个标题在 472 快照中也存在（**标题级重合**，ID 不同 → 属不同投递岗；是否与生产库重复须以上表 ID 差集为准）。

## 6. 生产写入建议（需另行授权）

```
gh workflow run refresh.yml --ref task-1-m0-contracts \
  -f sources=jd \
  -f start_page=3 -f page_size=25 -f max_pages=1 \
  -f max_jobs=25 -f global_cap=25 -f model_cap=10
```

- **模型预算**：按 Phase 1B 实测 0.15 次/条 → 25 条 ≈ **4 次调用**；建议 `model_cap=10`（2.5× 余量）。
- **时间预算**：本地 26.3s（search 13% / detail 87%）；runner 约 2–3× → **~60–80s**，远低于 5 分钟来源预算。
- **窗口正确性**：`start_page=3 × page_size=25 × max_pages=1` = 位次 51–75，与已覆盖的 1–50 不重叠（本轮实测 0 重叠）。
- 每日定时调度**不受影响**（无 inputs → start_page 1、page_size 2、max_jobs 2）。

## 7. 失败处理（与既有流程一致）

1. **写入前基线**：记录 `source_records where source='job-pro:jd'` 的 `source_job_id` 集合与 `count(*)`；`summary.json` 自带 `baseline{records,jobs,ready}`。
2. **PARTIAL 退出码为 0**：不得只凭 Actions 绿色判定成功，必须读 `summary.json` 与 Step Summary 的 PARTIAL 段。
3. **失败/部分失败**：保留 checkpoint 与 summary（workflow 已归档），**只读核对，不自动删除、不盲目重跑**。
4. **回退口径**：`source_records` 是 `on_conflict=(source,source_job_id)` 的 merge-duplicates，**不能按 `fetched_at` 删除**（会误删被刷新时间戳的既有记录）。正确口径是**写入前 ID 集合差集**，精确删除新增 ID 后重新触发一次 refresh 让 canonicalize 收敛；该删除属生产写操作，需单独授权。
5. **续跑安全**：checkpoint 记录 `startPage`；改变起始页/页大小/预算后续跑旧 checkpoint 会被 `Resume configuration differs` 拒绝。

## 附：本轮边界

未 `--write`、未触发 Actions、未调用 DeepSeek、未写生产库、未 push/部署、未重试历史失败岗位、未改 Qualification/Gate/Evidence、未改分类规则与 UI、未扩大来源。分析产物在 gitignore 的 `.verification/product04c/`（`jd-page3.json`、`jd-page3-ids.json`、`jd-page3-search.json`、`jd-page3-candidates.json`）。
