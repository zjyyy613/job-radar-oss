# 扩容结果核验报告

> 内部状态：**PARTIAL** ｜ 审查结论：**REVIEW** ｜ 流水线退出码：0

## 基线 → 结果

| 项 | 值 |
| --- | --- |
| 运行前 source_records / jobs / ready | 473 / 472 / 414 |
| 新增（inserted） | **38** |
| 更新（updated） | 0 |
| 未变化（unchanged） | 0 |
| canonical 新增 / 变化 | 38 / 0 |

## 资格提取

| 项 | 值 |
| --- | --- |
| 待提取 / 解析器可处理 | 38 / 6 |
| 成功 / 失败 / 延后 | **28 / 10 / 0** |
| ready jobs | 34 |
| 证据引文校验 | 34 |
| DeepSeek 调用 / 上限 | **10 / 20**（50%） |

## 分来源耗时与停止原因

| 来源 | 状态 | 停止原因 | 总耗时 | search | detail | upsert |
| --- | --- | --- | --- | --- | --- | --- |
| job-pro:xiaomi | partial | source_timeout | 303.1s | 41.2s | 248.9s | 12.9s |

## 失败原因汇总

| 来源 | 原因 | 次数 |
| --- | --- | --- |
| job-pro:xiaomi | source_timeout | 1 |

## 提取明细（失败优先）

| job id | 状态 | 诊断 |
| --- | --- | --- |
| 0e0b1f2a-0000-4000-8000-000000000001 | failed | required_without_deterministic_confirmation |
| 0e0b1f2a-0000-4000-8000-000000000002 | failed | required_without_deterministic_confirmation |
| 0e0b1f2a-0000-4000-8000-000000000003 | failed | required_without_deterministic_confirmation |
| 0e0b1f2a-0000-4000-8000-000000000004 | failed | required_without_deterministic_confirmation |
| 0e0b1f2a-0000-4000-8000-000000000005 | failed | minimum_not_confirmed_by_quote |
| 0e0b1f2a-0000-4000-8000-000000000006 | failed | minimum_not_confirmed_by_quote |
| 0e0b1f2a-0000-4000-8000-000000000007 | failed | student_status_not_confirmed_by_quote |
| 0e0b1f2a-0000-4000-8000-000000000008 | failed | preferred_context_marked_mandatory |
| 0e0b1f2a-0000-4000-8000-000000000009 | failed | metadata_branches_ungrounded |
| 0e0b1f2a-0000-4000-8000-00000000000a | failed | unsupported_branches_present |
| 0e0b1f2a-0000-4000-8000-00000000000b | success | — |
| 0e0b1f2a-0000-4000-8000-00000000000c | parser_only | — |

## 必须人工处理

- 内部状态为 PARTIAL，但流水线退出码仍为 0：**不要仅凭 Actions 绿色判定成功**，以本报告与 summary.json 为准
- 10 条资格提取失败：已被 attempt hash 记录，**不得无授权重试模型**，需人工复核诊断后另行授权
- 来源 job-pro:xiaomi 触发 source_timeout：本批少采集，需评估分页/预算后另开新批次

## 说明

- 净新增以数据库 upsert 判定的 inserted 为准，候选数不能替代

## 附：既有 refresh Step Summary（原文复用）

## Job Radar refresh — PARTIAL

> **PARTIAL** — 部分来源或部分岗位提取失败。**退出码仍为 0**（策略未变），请维护者按下方统计核查。

- 提取：成功 28 · 失败 10 · 延后 0
- 来源：成功 0 · 部分 1 · 失败 0（共 1）

| 指标 | 值 |
| --- | ---: |
| 来源 成功 / 部分 / 失败 | 0 / 1 / 0 |
| 列表读取 / 详情成功 / 准入通过 | 38 / 38 / 38 |
| 新增来源记录 / 更新 / 未变化 | 38 / 0 / 0 |
| 岗位 新增 / 变化 / 总计 | 38 / 0 / 510 |
| 来源记录总数 | 511 |
| 提取 待处理 / parser-only / 模型调用 | 38 / 6 / 10 |
| **提取 成功 / 失败 / 延后** | **28 / 10 / 0** |
| 就绪岗位 / 已核验 evidence | 34 / 34 |
| 耗时 (ms) | 303114 |

### 失败诊断分布

| 诊断（stage:code:path#index） | 数量 |
| --- | ---: |
| `required_without_deterministic_confirmation` | 4 |
| `minimum_not_confirmed_by_quote` | 2 |
| `metadata_branches_ungrounded` | 1 |
| `preferred_context_marked_mandatory` | 1 |
| `student_status_not_confirmed_by_quote` | 1 |
| `unsupported_branches_present` | 1 |

<details><summary>完整结果 JSON</summary>

```json
{
  "_note": "Reconstructed from the documented metrics of the first production expansion (run 38929512185 / job 117069582517): 472 -> 510 jobs, 38 written, 28 extraction success / 10 failure, 10 model calls, 19 pages, 303114 ms, stop_reason=source_timeout, internal status=partial.",
  "status": "partial",
  "success": 0,
  "partial": 1,
  "failed": 0,
  "sources_attempted": 1,
  "listed": 38,
  "detail_success": 38,
  "admitted": 38,
  "inserted": 38,
  "updated": 0,
  "unchanged": 0,
  "canonical_new": 38,
  "canonical_changed": 0,
  "source_records": 511,
  "canonical_jobs_total": 510,
  "extraction_pending": 38,
  "parser_only": 6,
  "model_calls": 10,
  "extraction_success": 28,
  "extraction_failure": 10,
  "extraction_deferred": 0,
  "ready_jobs": 34,
  "evidence_quotes_verified": 34,
  "duration_ms": 303114,
  "baseline": {
    "records": 473,
    "jobs": 472,
    "ready": 414
  },
  "source_runs": [
    {
      "source": "job-pro:xiaomi",
      "status": "partial",
      "records_seen": 38,
      "pages_fetched": 19,
      "stop_reason": "source_timeout",
      "failure_reasons": {
        "source_timeout": 1
      },
      "duration_ms": 303114,
      "search_ms": 41200,
      "detail_ms": 248900,
      "upsert_ms": 12900
    }
  ],
  "extracted": [
    {
      "id": "0e0b1f2a-0000-4000-8000-000000000001",
      "status": "failed",
      "diagnostic": "required_without_deterministic_confirmation"
    },
    {
      "id": "0e0b1f2a-0000-4000-8000-000000000002",
      "status": "failed",
      "diagnostic": "required_without_deterministic_confirmation"
    },
    {
      "id": "0e0b1f2a-0000-4000-8000-000000000003",
      "status": "failed",
      "diagnostic": "required_without_deterministic_confirmation"
    },
    {
      "id": "0e0b1f2a-0000-4000-8000-000000000004",
      "status": "failed",
      "diagnostic": "required_without_deterministic_confirmation"
    },
    {
      "id": "0e0b1f2a-0000-4000-8000-000000000005",
      "status": "failed",
      "diagnostic": "minimum_not_confirmed_by_quote"
    },
    {
      "id": "0e0b1f2a-0000-4000-8000-000000000006",
      "status": "failed",
      "diagnostic": "minimum_not_confirmed_by_quote"
    },
    {
      "id": "0e0b1f2a-0000-4000-8000-000000000007",
      "status": "failed",
      "diagnostic": "student_status_not_confirmed_by_quote"
    },
    {
      "id": "0e0b1f2a-0000-4000-8000-000000000008",
      "status": "failed",
      "diagnostic": "preferred_context_marked_mandatory"
    },
    {
      "id": "0e0b1f2a-0000-4000-8000-000000000009",
      "status": "failed",
      "diagnostic": "metadata_branches_ungrounded"
    },
    {
      "id": "0e0b1f2a-0000-4000-8000-00000000000a",
      "status": "failed",
      "diagnostic": "unsupported_branches_present"
    },
    {
      "id": "0e0b1f2a-0000-4000-8000-00000000000b",
      "status": "success"
    },
    {
      "id": "0e0b1f2a-0000-4000-8000-00000000000c",
      "status": "parser_only"
    }
  ]
}
```
</details>
