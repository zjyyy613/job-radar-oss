# Task 3 NCSS smoke — 2026-09-28

## 基线与固定版本

- 开始时工作区 clean，基线提交 `4c4ccb3`。
- JobHunter: `Bynlk/JobHunter@4b5a69010a98b3d80b408fd983c1c2dfa60788e4`。
- 仅本地提取该 commit 的 `crawler/ncss_crawler.py` 会话、列表请求和字段映射路径；
  附原文件 SHA-256、MIT 许可与变更说明，不依赖 moving branch。
- Python 3.13 / Playwright 1.63.0 / Chromium 153.0.8010.12。
- 无 Flask、SQLite、Vue、通用官网 crawler、重复公司 API 或 stealth 依赖。
- 领域契约、SQL schema、job-pro 实现和 workflow 均未修改。

## Fixture 与验证

- 先保存真实 NCSS 两条列表响应，再写离线测试；实现缺失时已确认 RED。
- 真实字段包括标题、公司、地区、薪酬、学历、发布时间、企业性质、规模、福利及来源 ID。
- 实际响应不含行业；真实 fixture 不补字段，单独合成 fixture 验证行业字段和 alias。
- SourceRecord 不含学历属性，学历原文保留在 raw_payload；不伪造 requirements 或 gates。
- raw_payload 保留整条上游对象；source_url 使用 pinned crawler 的 jobId URL 模板。
- 最终 lint / typecheck / test / build 全部通过：7 个 Vitest 文件、130 项测试，
  其中一个测试执行 12 项 Python unittest（无需 Playwright、网络或 Supabase）。
- Python 测试覆盖缺失值、行业 alias、小数薪酬、无效时间戳、原始载荷、稳定 hash、
  响应错误、来源失败隔离、部分成功、幂等更新、写入/审计失败、凭据优先级与跨来源写入拒绝。
- TypeScript 边界测试检查 Python 输出与冻结 SourceRecord 的属性集合一致。

## 真实 smoke

```sh
python scripts/ingest/run-ncss.py --write --limit 2
```

本机使用 `.venv-ncss/Scripts/python.exe`，浏览器下载目录设为 ignored
`.verification/playwright`。使用 `.env.local` 的 SUPABASE_SECRET_KEY；未回显密钥。

- 时间：2026-09-28 10:00:19–10:00:37（Asia/Shanghai）。
- NCSS 获取：2；Supabase 确认新增：2；更新：0；失败：0。
- Run ID：`43fd1765-8a00-49d7-abc1-8bedebd31624`，status=success，full_list=false。
- 来源 ID：`SLaDB8f5H72xoPf8Xxek6Q`、`NrYjnQkKLL4VQopf4HA5TZ`。
- 读回标题、公司、ID 与 raw_payload 一致；薪酬分别为 `5K-15K/月`、`5.4K-10K/月`；
  学历分别为“本科及以上”“不限”；industry=null。
- 最终 NCSS：2 条 source_records、1 条 source_runs；jobs=0。
- job-pro 前后均为 6 条来源记录、6 条运行记录，完整行内容摘要相同：
  - source_records: `8b9bd0454c03c4f1e3ee582fdfd1d800`
  - source_runs: `aa635b0cdc10202b40bb720fef737fb7`

## 自审与限制

- 已自审 pin/许可、字段和 SQL 对齐、空值、raw、时间戳、来源隔离、服务端鉴权、
  重定向拒绝、确认写入、失败日志、workflow 独立性及任务范围。
- 真实页面/session/API 当前可用，无需兼容性绕过；没有真实失败来源。
- 仅第一页小样本，不证明全量、长期可用性或所有行业字段覆盖。
- 列表可能含非校招岗位；不从 title/recruitType 编码猜测 internship_type 或招聘批次。
- 未采集详情：description、requirements、deadline、apply_url 保持 null。
- NCSS 是公共就业补充来源（trusted_aggregator），不能将其失败/缺失用于权威来源关闭推断。
- workflow 已在本地定义；未推送、配置 GitHub Secrets 或在 GitHub 执行。
- 进程被强制终止、CI 安装失败、Supabase 不可用时不能保证写入失败日志；正常抓取异常由 runner 捕获并记录。
- Task 2 已记录的远程/本地 migration 历史差异仍存在；将来使用 db push 前需先对齐，不重复执行初始 DDL。
- 无需在 Task 4 前解决的新增阻塞；停止于 Task 3，未实现 canonicalization、jobs、Gate Extraction 或 UI。
