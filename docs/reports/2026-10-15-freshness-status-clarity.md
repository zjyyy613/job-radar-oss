# Product Improvement v1 · Task 4：时间与招聘状态表达

验收日期：2026-10-15。结果：PASS。本地 production 模式验证；不 push、不部署。

## 实际字段含义

- `published_at`：job-pro adapter 读取 upstream `post_date`；NCSS 读取有效 `publishDate` 毫秒时间。缺失保持 null。canonicalization 保留主来源的值，不代表系统首次发现时间。
- `fetched_at`：当前被接纳来源内容的获取时间。job-pro 成功取得 detail 并通过 admission 后写入；NCSS 映射时写入。现有 source store 以 `(source, source_job_id)` upsert，重新获取即更新，即使 JD hash 未变。
- `last_seen_at`：现有两个 adapter 与 fetched_at 同时赋值，表示该次成功来源记录观察，不是额外执行的开放状态检查。
- `application_status`：独立由现有 source reliability/run replay 计算。本轮不改计算；Open 是规则支持的来源开放记录，Unknown 不是 Closed，二者均不是资格判断。

检查路径：`scripts/ingest/job-pro-adapter.ts`、`run-job-pro.ts`、`ncss-adapter.py`、`run-ncss.py`、`source-store.ts`；`src/lib/domain/canonicalize.ts`、`source-reliability.ts`；现有 canonicalization migrations。没有更改这些文件。

## 最小修改

- Radar 与 Saved 共用 JobRow：日期标签从“收录”改为“获取”。排序名称改为“最近获取”，资格优先的次序说明同步更新；URL 的 `sort=freshness` 不变。
- 获取日期仅使用有效 source fetched_at 的实际最大时间，不再用 published_at 补位。缺失时“未提供”，按获取排序排在有日期岗位之后。按时间戳比较兼容时区偏移。
- Detail Peek / Full Detail 顶部明确招聘状态及官网核验提示；Eligible 文案注明不代表当前可投递。Closed 原有不可申请行为保留。
- 来源区分别展示“来源标注发布”“最近获取”“最近观察到”。保留原始来源与官网申请入口，不自动核验官网。未提供发布时间明确显示“未提供”。
- 未改数据库、原始地点、身份、Evidence、Qualification、Reliability、采集/提取流水线、样式、依赖或 Task 1–3 功能。

## 真实数据只读核验

快照时间：2026-10-15 05:13:09 UTC。

| 项目 | 数值 |
|---|---:|
| Canonical jobs / source records | 429 / 429 |
| 公司 | 13 |
| 有真实 published_at / 缺失 | 2 / 427 |
| Open / Unknown / Closed | 22 / 407 / 0 |
| fetched_at = last_seen_at / 不同 | 429 / 0 |
| 读取 warnings | 0 |

当前两个时间相等源自 adapter 写入行为，不代表“观察到”就是已验证开放。与本地旧只读快照按 ID、相同 raw_content_hash 对比，确认至少 14 条 JD 未变但 fetched_at 更新；这是可比样本数，不是所有历史重复抓取数量。数据库没有提供本轮可用的首次收录事实，不推断。

实际样本：

- 中国银行校园招聘：来源发布时间 2026-09-04，获取/观察 2026-09-28，Unknown。原始 NCSS publishDate 与 published_at 一致。
- 保禄翊腾“制袋学徒”：来源发布时间 2026-09-27，获取/观察 2026-09-28，Unknown；同样核对原始 publishDate。
- 美团“海外运营实习生”：无发布时间，内容 hash 未变，获取从 10-02 更新至 10-12；不能称“10-12 新发布”。
- 快手“【留用实习】策略产品经理-商业化方向”、理想汽车“充电网络工程供应管理实习生”：无发布时间、同 hash，获取从 10-09 更新至 10-15。
- 阿里巴巴“潮玩-品牌营销实习生”：Unknown + ready/zero gates，在验收 Profile 下资格无明显冲突，界面明确两者独立。

完整脱敏统计/样本见 `assets/freshness-status-v1/data-audit.json`。未写入数据库，未运行 ingestion / extraction。

## 验证与自审

- lint PASS；typecheck PASS；25 个测试文件、411 tests PASS；production build PASS。
- 新增 4 项回归：无获取时间不能用发布时间替代、跨时区获取顺序、重新获取不改变发布时间/资格、Unknown 与 Eligible 独立。既有地点、组合筛选、Saved、资格与可靠性测试全量通过。
- 本地 production server + 真实 Supabase：1440px Desktop / 390px Mobile 各读取 429 条；检查搜索+公司+获取排序、Detail Peek→Full Detail、Open 文案、Unknown+Eligible、银行两个日期、Saved 当前数据及时间标签。浏览器 pageerror 为 0，无水平溢出。
- 截图已人工检查：`desktop-radar.png`、`desktop-detail.png`、`mobile-radar.png`、`mobile-detail.png`；结果记录 `browser-results.json`。
- 自审确认唯一排序边缘变化：来源 metadata 缺失时不再拿发布时间冒充获取时间；没有可证实获取时间的岗位安全排后。保留 URL 参数与现有筛选语义。
- 真实数据库没有 Closed 岗位，Closed 依赖现有自动测试，未伪造真实 Closed 样本。未自动逐条访问招聘官网，不声称当前实际可申请。
- 未重新执行 Task 1–3 全部历史手工流程；相关单元回归全量通过，本轮真实浏览器检查覆盖受影响的共享列表/详情/Saved 和组合筛选路径。

本轮没有新的部署阻断项。既有缺失发布时间、Unknown 状态和 extraction failure 仍按原有规则处理。等待统一验收。
