# Job Radar 数据覆盖评估（DATA-01）与官方来源扩量验证（DATA-02）

- 日期：2026-10-15
- Owner：DSH / DeepSeek
- 分支：`work/dsh`
- 范围：DATA-01 只读覆盖评估 + DATA-02 `tencent / intern` 有界 `--dry-run` 实测
- 未做：未写数据库、未调用 DeepSeek 模型、未修改采集脚本或 GitHub Actions、未 push / 部署

## 结论摘要

1. 库内 429 jobs / 13 公司，但**公司分布是摄入预算的产物，不是市场结构**：8 家受调度源占 98.0%，腾讯/小米/vivo 各仅 2 条，且在现有调度下不会增长。
2. 8 家受调度源对上游的覆盖率约 **11.4%**（396 / 3472，按各源抓取当时 `total`）；被排除在调度外的腾讯+小米+vivo 仅 **0.44%**（6 / 1355）。
3. 方向覆盖高度偏斜：真实标题样本中**建筑、法学为 0**，人力/金融各 1；唯一跨域来源 NCSS 全库仅 2 条，且正文与申请链接恒为 null。
4. `published_at` 仅 2/429、`internship_type` 与 `recruitment_batch` 全库 0 —— **根因已定位到 adapter 的少数几行代码，而不是来源缺失**（见 3.6）。
5. **DATA-02 实测通过**：腾讯 intern 10 条候选，2 页、详情 10/10、准入 10/10、12.8s、0 失败，10/10 带官方 `join.qq.com` 申请链接，方向包含当前库内缺失的金融/咨询类。**判定值得进入每源 20–60 条的下一轮验证。**

---

## 一、取数基础与口径

| 证据类型 | 来源 | 等级 |
| --- | --- | --- |
| 实时生产数据 | ChatGPT 经 Supabase 只读查询（429 jobs / 13 公司等） | 实测（他人执行，DSH 未连库） |
| 快照 / 指标 JSON | `docs/reports/assets/freshness-status-v1/data-audit.json`（429 口径）、`docs/reports/2026-10-02-m05-phase1a-metrics.json`、`docs/reports/2026-10-03-m05-phase1b-metrics.json` | 实测 |
| 已验收报告 | freshness / location / browse-filters / saved / Phase 1A·1B·2A / 来源扩展审计 | 实测（他人记录） |
| 上游真实 fixture | `tests/fixtures/job-pro/*-search.json`（11 家，2026-09-28~10-02 抓取）、`tests/fixtures/ncss/list-live.json` | 实测样本 |
| 代码 | `scripts/ingest/job-pro-adapter.ts`、`scripts/ingest/run-job-pro.ts`、`scripts/ingest/job-pro-cli.ts`、`scripts/ingest/job-pro-sources.ts`、`.github/workflows/refresh.yml`、`src/lib/radar/presentation.ts` | 第一手核验 |
| DATA-02 实测 | 本次 `tencent / intern` dry-run 与其同源 CLI 只读请求 | 实测（本轮） |

**口径不可混用**：`429` 为 2026-10-15 实时查询与快照；`411` 为 2026-10-09 / 10-10 报告；`404` 为 Phase 1A 基线。城市与公司分布类数字均已标注口径。

---

## 二、DATA-01：当前数据覆盖评估

### 2.1 公司 / 来源分布（**推导值**，非直接读库）

429 实时快照只给出公司总数与名单，无逐公司数量。下表由 Phase 1A 每源写入数 + Task 2 记录 + NCSS 记录重建（404 基线 + 25 条增量 = 429）：

| 公司 | 岗位数 | 占比 | 依据 |
| --- | ---: | ---: | --- |
| 阿里巴巴 / 美团 / 京东 / OPPO / 理想汽车 | 各 50 | 各 12.4% | Phase 1A metrics `inserted` |
| 快手 / 蚂蚁集团 | 各 49 | 各 12.1% | 同上（各拒 1 条） |
| 网易 | 48 | 11.9% | 同上（拒 2 条） |
| **腾讯 / 小米 / vivo** | **各 2** | **各 0.5%** | Task 2 smoke 报告 |
| 中国银行 / 保禄翊腾包装 | 各 1 | 各 0.25% | NCSS fixture + 公司名单 |

- 8 家受调度源 = **396/404 = 98.0%**；Top 5 = 61.9%；腾讯+小米+vivo = **1.5%**；NCSS = **0.5%**。
- 实时快照已显示网易 64、美团 59，说明增量主要落在受调度的 8 家；腾讯/小米/vivo 仍为 2。
- **判断**：11 家源在库内几乎都是 ~50 条，正是 Phase 1A 的 `--limit 25 --max-pages 2 --max-jobs 50` 上限；所有源 `stop_reason=max_jobs`，即**上限先到、来源后到**，与上游真实供给无关。

### 2.2 上游供给 vs 已摄入（fixture 抓取当时 `total`）

| 源 | 上游 total | 库内 | 覆盖率 |
| --- | ---: | ---: | ---: |
| 理想汽车 | 1027 | 50 | 4.9% |
| 小米 | 786 | 2 | 0.25% |
| 阿里巴巴 | 615 | 50 | 8.1% |
| 网易 | 563 | 48 | 8.5% |
| 蚂蚁集团 | 461 | 49 | 10.6% |
| 腾讯 | 404（campus） | 2 | 0.50% |
| 美团 | 377 | 50 | 13.3% |
| 快手 | 228 | 49 | 21.5% |
| vivo | 165 | 2 | 1.2% |
| 京东 | 104 | 50 | 48.1% |
| OPPO | 97 | 50 | 51.5% |

- 8 家受调度源：上游 3472，库内 396 → **11.4%**
- 腾讯+小米+vivo：上游 1355，库内 6 → **0.44%**
- 上游供给相差 10.6 倍（1027 vs 97），库内却被压成 ~50 的均匀切片 → 分布失真。

**调度机制（第一手）**：`.github/workflows/refresh.yml` 默认 `sources = alibaba,meituan,jd,netease,kuaishou,oppo,liauto,antgroup`（**不含腾讯/小米/vivo**）、`max_pages=1`、`max_jobs=2`、`global_cap=16`。即每日只重读每源**第 1 页 2 条**，从不遍历积压；实测增长约 3 条/天（404→409→411→429）。

### 2.3 城市覆盖（411 口径）

| 事实 | 值 |
| --- | --- |
| 识别到的规范城市/地区 | 54（+2 项保留原值 → 下拉 56） |
| 至少可识别一个城市的岗位 | 410/411 |
| 北京 / 上海 / 深圳 | **232 / 88 / 66**（按 job ID 去重） |
| 归一后多城市岗位 | 124 |
| 城市无法归类的岗位 | 2（"浙江" 1、"海南省-澄迈县" 1） |

北京 232/411 = **56.4%**；上海 21.4%；深圳 16.1%。因 124 条岗位跨多城会被重复计入，前三城 386 次命中对应的去重岗位数在 **232–386 之间（56%–94%）**。

**「有选项但岗位很少」无法用现有证据量化**：除京沪深外的 51 城，其岗位总数只能在 **25–179 条**之间（411−386 与 411−232），7 倍不确定；**没有任何报告给出逐城市岗位数**。这本身是需补测的取数缺口。

### 2.4 专业与岗位方向

**结构限制（第一手）**：通用搜索 `q` 只匹配 `title + company + location`，**不匹配 JD 正文**（`src/lib/radar/presentation.ts:87-91`）；偏好 `role` 只匹配标题（`:83-86`）。`description` / `requirements` 在库中但**不可检索**。

方向样本（11 家源首屏共 28 条真实标题）：

| 方向 | 样本数 | 代表标题 |
| --- | ---: | --- |
| 计算机 / AI / 算法 / 软件 | ~14 | AI全栈工程师、Agent开发工程师、影像算法工程师、医学世界模型、大模型算法工程师 |
| 产品 / 运营 / 营销 / 商务 / 设计 | ~12 | 策略产品经理、市场营销实习生、海外商务、交互设计师、原画设计实习生、物流运营 |
| 机械 / 制造 / 供应链 / 电气 | 2 | 充电网络工程供应管理实习生、技术规划工程师（电声） |
| 人力 | 1 | 招聘实习生、人事运营 |
| 金融 / 财会 | 1 | Channel Finance BP（小米，工作地巴黎） |
| **建筑 / 土木** | **0** | — |
| **法学** | **0** | — |

叠加：① NCSS 是唯一跨域来源，全库仅 2 条，其中"中国银行 2027 年全球校园招聘公告"是**公告而非具体岗位**，另一条是"制袋学徒"；② NCSS 的 `description`/`requirements`/`apply_url`/`deadline` **恒为 null**（`scripts/ingest/ncss-adapter.py`），`internship_type`/`recruitment_batch` 亦为 null。

**因此「岗位稀缺」与「资格不符」在当前产品里不可区分**：搜"建筑/法学"无结果时，无法说明是数据没有、检索够不到正文、还是确实不匹配。

### 2.5 字段完整性

| 字段 | 实时数据 | 影响 |
| --- | --- | --- |
| `published_at` | **2/429**（均为 NCSS） | 新鲜度只能用 `fetched_at`（抓取时间）替代 |
| `application_status` | Open 22 / Unknown 407 / Closed 0 | 95% 岗位状态未明 |
| `internship_type` / `recruitment_batch` | **0 / 429** | 无法按实习类型或招聘批次筛选 |
| JD 与申请链接 | 427 条有职责 + 任职要求 + 申请链接 | job-pro 侧正文完整（NCSS 2 条除外） |
| extraction | ready 363 / failed 66 | failed 恒为 `Check`("资格信息待确认")，不自动重试 |

### 2.6 最重要的 3 个问题

**P1｜覆盖深度被摄入配置双重锁死，公司分布是配置产物**
库内"腾讯 2 / 小米 2 / vivo 2"而"OPPO 50"并非市场事实（小米上游 786、腾讯 404 均远大于 OPPO 97）。根因：① Phase 1A 的 `--sources` 未含腾讯/vivo，小米 429 被排除；② `refresh.yml` 默认只跑同 8 家且 `max_pages=1 / max_jobs=2`，从不遍历积压。城市侧同理集中于京沪深（北京 56.4%），其余 51 城实际岗位数无法确定。

**P2｜跨专业方向结构性空缺，且检索通道够不到 JD 正文**
28 条真实标题中建筑、法学为 0，人力/金融各 1，AI/算法+产品运营约 93%。唯一跨域来源 NCSS 全库 2 条且正文/申请链接恒 null。搜索只覆盖标题/公司/城市 → 跨专业用户无法判断"没搜到"的真实含义。

**P3｜时间与实习类型字段缺失，使"新鲜度/类型"筛选不可用**
`published_at` 2/429、`internship_type` 0/429、`recruitment_batch` 0/429；66 条提取永久失败恒为 `Check`。界面只能用抓取时间排序，无法判断上架时间、实习类型或是否仍开放。

---

## 三、DATA-02：`tencent / intern` 有界 dry-run 实测

### 3.1 环境与命令

- 先在 `E:\job-radar-dsh` 执行一次 `npm ci`（仅按现有 lockfile 安装，未改版本）：487 packages，47s，exit 0。执行后 `git status` 干净，`package.json` / lockfile 未变；`@ha7ch/job-pro` 为 `1.2.1`（与 `JOB_PRO_VERSION` 一致）。
- 工作区**无 `.env.local`**，`--dry-run` 下脚本不创建 store，因此**未加载任何密钥、未连数据库**（`scripts/ingest/run-job-pro.ts:151-156`）。
- 实测命令：

```powershell
npm run ingest:job-pro -- --sources tencent --scope intern --limit 5 --max-pages 2 --max-jobs 10 --global-max-jobs 10 --dry-run
```

### 3.2 实测结果

| 指标 | 值 |
| --- | --- |
| status / exit code | `success` / `0` |
| `pages_fetched` | **2** |
| `listed`（候选） | **10** |
| `response_records` / `duplicate_ids` | 10 / 0 |
| `detail_attempted` / `detail_success` | **10 / 10** |
| `admission_passed` / `admission_rejected` | **10 / 10 → 0** |
| `stop_reason` | `max_jobs`（预算先到，非来源问题） |
| `failure_reasons` | **{}（无任何失败）** |
| `duration_ms` | **12,777 ms**；外层 wall clock ≈ 13.7s（含 npm/tsx 启动） |
| 上游请求量 | 2 次 search + 10 次 detail = 12 次 CLI 调用，串行、每次前置 350ms 间隔 |
| 限流 / 验证码 / 权限 | **未出现** `rate_limited` / `access_denied` / `network_failed`；未绕过任何访问控制 |

（`job-pro-cli.ts` 的内部传输重试次数不体现在输出中，故"是否发生过一次重试"无法从此输出判断。）

### 3.3 岗位标题与方向覆盖（10 条，label 与 project 均为「应届实习」）

| # | 标题 | 方向归类 | 城市 | 官方申请链接 |
| ---: | --- | --- | --- | --- |
| 1 | 后台开发 | 技术/后端 | 深圳总部·北京·上海·广州·成都·杭州 | ✔ |
| 2 | 算法-多模态方向 | AI/算法 | 深圳总部·北京·上海·广州·成都 | ✔ |
| 3 | 算法-自然语言处理方向 | AI/算法 | 深圳总部·北京·上海·广州·成都 | ✔ |
| 4 | 技术研究-高性能计算方向 | 技术/研究 | 深圳总部·北京·上海·广州 | ✔ |
| 5 | 解决方案-行业咨询方向 | **咨询/解决方案** | 深圳总部·上海 | ✔ |
| 6 | CSIG技术产品商务培训生 | **商务/产品** | 西安·深圳总部·北京·上海·广州·杭州·南京·厦门·中国香港 | ✔ |
| 7 | 项目管理 | **项目管理** | 深圳总部·上海 | ✔ |
| 8 | 行业运营 | **运营** | 深圳总部·北京·上海·广州 | ✔ |
| 9 | 投资分析 | **金融/投资** | 北京 | ✔ |
| 10 | 投资分析（技术方向） | **金融/投资（技术向）** | 北京 | ✔ |

**新发现覆盖不足的类型**：本样本中 **投资分析 ×2（金融/投资）**、**解决方案-行业咨询**、**项目管理**、**商务培训生** 属当前库内几乎缺失的方向（DATA-01 样本中金融仅 1 条、咨询/项目管理为 0）。这说明腾讯 `intern` 池并非纯技术岗，**扩量可同时改善"方向覆盖"而不只是"数量覆盖"**。

### 3.4 JD 与官网申请链接

抽查 2 条 detail（技术向与非技术向各一）：

| 抽查项 | 后台开发 | 投资分析 |
| --- | --- | --- |
| `description` 长度 | 292 字符 | 303 字符 |
| `requirements` 长度 | 242 字符 | 394 字符 |
| `apply_url` | `https://join.qq.com/post_detail.html?postid=…` | 同左 |
| 域名与 ID 校验 | 通过（host = 上游 `join.qq.com` 且 URL 含 `source_job_id`） | 通过 |

- **JD 完整**：10/10 通过准入，准入要求正文去标点后 ≥80 字符且 ≥12 种字符（`job-pro-adapter.ts:124-128`），故均有可用正文。
- **链接可信**：10/10 有官方 `join.qq.com` 申请链接；`detailAdmission` 会拒绝非官方 host 或不含 ID 的链接。
- 注意：detail 载荷含 `description`、`requirements`、`apply_url`、`work_cities`、`direction`、`is_qingyun`，但**不含 `bgs`**，且**不含任何发布时间字段**（见 3.6）。

### 3.5 与当前库内岗位的关系（增量判断）

- 仓库 fixture 记录的腾讯 campus 抓取为 2 条：`1282707398326592512`（AI全栈工程师）、`1282707395466077184`（Agent开发工程师），label = `应届毕业生`。
- 本轮 intern 10 条 ID 与上述 2 条 **交集为空**；两者查询参数亦不同（campus `projectMappingIdList=[1,14]` vs intern `[2,104,20]`），属不同岗位池。
- **结论：这 10 条"疑似增量"，但"库内是否已存在"标记为未知。** 我无法只读核实库内 `source_job_ids`（无数据库只读权限，且未使用任何密钥），因此**不声称新增**；最终以写库前的身份查询结果为准。

### 3.6 根因发现：字段缺失来自 adapter，不是来源

| 发现 | 证据 |
| --- | --- |
| `published_at` 仅 2/429，且两条均属 NCSS | 实时查询 + `data-audit.json` 的 `upstream_examples` 均为 ncss `publishDate` |
| job-pro adapter 只从 `payload.post_date` 取发布时间 | `scripts/ingest/job-pro-adapter.ts:88` |
| 本轮两条腾讯 detail 载荷**均无 `post_date` 字段** | 实测 detail 顶层键：`apply_url, description, direction, is_qingyun, ok, post_id, project, recruit_cities, recruit_label, requirements, source, title, work_cities` |
| `internship_type` / `recruitment_batch` **硬编码为 null** | `job-pro-adapter.ts:80-82`，注释："CLI project/recruit_label/kind do not reliably identify batch/internship type." |
| 上游其实提供了 `recruit_label`（应届实习）与 `project`（应届实习） | 本轮 10/10 搜索与 detail 均含该字段，但未被采纳 |

即：**实习类型与发布时间为 0，是映射层的保守选择与字段缺失，而非上游完全没有信息。** 这是一个投入很小、收益明确的改善点（需产品侧先定义"实习类型"的语义与可信映射规则）。

### 3.7 是否值得进入每源 20–60 条的下一轮验证

**值得，建议继续。** 依据：

- 成功率：详情 10/10、准入 10/10、失败 0，未触发限流或访问控制。
- 成本：12 次串行调用 12.8s（≈1.1s/次、≈1.3s/条候选）。按此线性估算，单源 60 条约 65–80s，远低于每源 5 分钟预算与单次 45 分钟上限；与 Phase 1A 实测（每源 50 条用 56.9–193.6s）一致。
- 收益面：不仅增加数量，还能补入金融/投资、咨询、项目管理等当前缺失方向；且能验证"campus 与 intern 是两个不同岗位池"这一结构性事实（本源 intern `total` 607 vs campus 404）。

建议的下一轮（仍限定 dry-run，需 User 批准）：

1. 扩到 **2 家 × 20–60 条**，其中腾讯用 `intern`，另选一家画像不同的源（如网易或阿里）对比。
2. 记录：每源耗时、准入率、失败码、新增候选与库内 ID 的疑似重叠（重叠判断需数据库只读权限）。
3. **不要**把上游 `total`（如腾讯 intern 607）当作可投放岗位数；它是上游列表口径，含跨城市/跨 BG 的重复呈现，且可能随时间变化。
4. 先不改 `refresh.yml` 默认值、不做 `--write`、不调用模型；扩量结论明确后再单独申请改动自动刷新配置。

---

## 四、无法核实的信息

1. **无生产数据库只读权限**：2.1 的公司分布是推导值；DATA-02 的 10 条是否已在库内为**未知**，未声称新增。
2. 城市逐城岗位数、`internship_type`/`recruitment_batch`/`salary`/`deadline` 的完整度均不可得；429 口径的 extraction readiness 明细不可得。
3. 方向分布来自 28 条 fixture 首屏样本与 10 条本轮样本，非全量普查。
4. fixture 抓取于 2026-09-28~10-02，其 `total` 此后可能已变化。
5. `job-pro-cli` 内部重试次数不可见；本报告只声明未出现限流/权限类失败。
6. 线上已部署版本与本地基线的关系沿用 User 与 ChatGPT 的核实结论，本轮未独立验证。

## 五、边界声明

本轮**未修改**任何产品代码、采集脚本、数据库、workflow 或生产配置；**未执行 `--write`**；**未调用 DeepSeek 模型**；**未使用或复制任何密钥**；未 push、未合并、未部署。唯一的环境改动是在授权范围内执行一次 `npm ci` 安装现有锁文件依赖。
