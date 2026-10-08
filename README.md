# Job Radar

当前已完成 **M0 / Task 1–7**：冻结契约、多来源 ingestion、保守 canonicalization、source reliability、Gate Extraction、本地 Guest Profile、确定性资格引擎和 Radar Browse / Inspect / Full Detail。Task 7 视觉与 Brand Direction 已由用户 Freeze；未进入 M1。最终验收见 [M0 Final Acceptance](docs/reports/2026-10-01-m0-final-acceptance.md)。

冻结依据（按优先级）：
- [Product Spec v1.0](docs/specs/job-radar-product-spec-v1.0.md)
- [Technical Architecture v0.1](docs/architecture/job-radar-technical-architecture-v0.1.md)
- [M0 Implementation Plan](docs/superpowers/plans/2026-09-27-job-radar-m0.md)

## 本地运行

使用 Node.js 24 LTS、npm 和 Python 3.13；Node 依赖版本固定在 `package.json` 与 lockfile。
`npm test` 也会执行 NCSS 的 Python 标准库离线测试，无需安装 Playwright。
Python 默认 Windows 使用 `py -3`、其他平台使用 `python3`，可用 `NCSS_PYTHON` 指定解释器绝对路径。

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

根路径进入 `/radar`，Guest 可进入 `/onboarding` 填写资料，并在 `/profile` 查看、修改、清除。Profile 独立使用本地存储，不依赖外部服务；Radar 需要服务端 Supabase 配置及已归一化的真实 jobs。
Task 2 固定安装 `@ha7ch/job-pro@1.2.1`，通过公开 CLI/process 边界使用；未引入其私有 API、ORM、Auth 或状态库。Supabase 写入使用原生 fetch 调用 PostgREST。

## job-pro ingestion（Task 2 / M0.5 Phase 1A）

将 `.env.example` 复制为 `.env.local`，配置服务端 `SUPABASE_URL` 与 `SUPABASE_SECRET_KEY`。
新版 secret 优先，只放在 `apikey` 请求头；旧版 `SUPABASE_SERVICE_ROLE_KEY` 仅作 fallback。
不使用 `NEXT_PUBLIC_` 前缀，密钥不传给 job-pro 子进程、不进入输出或 Git。

```sh
# 真实来源抓取与归一化，不写数据库
npm run ingest:job-pro -- --dry-run --limit 2
# 三家公司各最多两条的真实写入 smoke
npm run ingest:job-pro -- --write --scope campus --limit 2
# 可选择 allowlist 子集；禁止 all / 其他公司
npm run ingest:job-pro -- --write --sources tencent,vivo --scope intern --limit 2
```

- 单一 allowlist 位于 `scripts/ingest/job-pro-sources.ts`，包含腾讯、小米、vivo，以及 Alibaba、Meituan、JD、NetEase、Kuaishou、OPPO、Li Auto、Ant Group；默认仍仅选择原三家。
- 默认每家公司 1 页、最多 5 条，全局最多 15 条。`--limit` 为页大小（最大 50），`--max-pages` 最大 20，`--max-jobs` 与 `--global-max-jobs` 最大 500。页大小保持不变；剩余额度不足一整页时正常停止，Ant Group 页大小最多 49。**不是全量采集**，所有 run 均为 `full_list=false`，不能用来推断岗位关闭。
- 只 upsert `source_records` 并写 `source_runs`；不处理 `jobs`、NCSS、canonicalization、gates 或 UI。
- 详情须通过身份、官方 locator、地点、正文准入：去除标题/空白/标点后至少 80 字符、12 种字符，无不可读编码或验证页。详情失败或未通过准入时跳过该条，不以稀疏列表覆盖已有详情；其他条目、公司继续处理。混合成功/失败输出 `partial`，不使整个命令失败；全失败或审计写入失败返回非零退出码。
- 每家公司有 5 分钟预算，到期不再启动下一条；在途 CLI/HTTP 请求另有 45/20 秒超时，随后继续其他公司。
- raw_payload 保留原始详情对象；raw_hash 使用稳定 key 排序的 SHA-256，与抓取时间无关。未支持的源字段仍完整保留在原始载荷中。
- 新增/更新计数基于写入前身份查询，仅统计已确认写入；更新包括刷新 `last_seen_at`。不要同时手动运行多个 writer。响应不明时不盲目重试写入，先检查数据库状态。
- 错误日志仅记录阶段标签，不回显密钥、上游原始错误或响应体。

既有 GitHub Actions 支持手动触发与每日 UTC 01:23 定时运行，串行执行。本轮未修改或执行 workflow；其现有 `--limit 20` 仍受新默认每源 5 条、全局 15 条约束，不自动扩量。
启用前在仓库 Secrets 配置 `SUPABASE_URL` 与 `SUPABASE_SECRET_KEY`（或旧版 fallback），并确保已有 Task 1 表结构。
workflow 已加入本地仓库，尚未推送或在 GitHub 上执行。

真实 fixture 的抓取命令与映射边界见 [fixture 说明](tests/fixtures/job-pro/README.md)。
真实 Supabase 写入、复跑与自审记录见 [Task 2 smoke 报告](docs/reports/2026-09-28-task2-job-pro-smoke.md)。

### M0.5 Phase 1A 受控扩量

```sh
npm run ingest:job-pro -- --write --sources alibaba,meituan,jd,netease,kuaishou,oppo,liauto,antgroup --scope intern --limit 25 --max-pages 2 --max-jobs 50 --global-max-jobs 400
npm run canonicalize -- --write
```

串行读取，首次请求间隔 350ms；网络/5xx 类读取失败最多重试一次，退避 1500ms；403/429 不重试并停止该源。输出 pages/list/detail/admission/write 指标及固定拒绝原因，不输出上游错误正文。所有有界 run 仍为 `full_list=false`。新增岗位不自动提取 gates，readiness 未完成时资格为 Check。

本次真实结果为新增 396 条，总计 404 records / 404 jobs；详见 [Phase 1A 报告](docs/reports/2026-10-02-m05-phase1a-official-ingestion.md)。来源选择依据为已验收的 [扩量审计](docs/reports/2026-10-02-m05-source-expansion-audit.md)。

## Task 3 NCSS ingestion

仅复用 JobHunter 的 NCSS 路径，固定 commit
`4b5a69010a98b3d80b408fd983c1c2dfa60788e4`；提取边界、原文件哈希及 MIT 许可见
[上游说明](scripts/ingest/vendor/jobhunter/NOTICE.md)。运行时不下载 JobHunter 或跟随分支。

```sh
python -m venv .venv-ncss
# 激活虚拟环境：Windows PowerShell 使用 .venv-ncss/Scripts/Activate.ps1
# macOS/Linux 使用 source .venv-ncss/bin/activate
python -m pip install -r scripts/ingest/requirements-ncss.txt
python -m playwright install chromium
python scripts/ingest/run-ncss.py --dry-run --limit 2
python scripts/ingest/run-ncss.py --write --limit 2
python -m unittest discover -s tests/ingest -p test_ncss.py
```

Windows 未配置 `python` 时可用 `py -3.13` 创建虚拟环境，激活后使用 `python`。
runner 读取同一 `.env.local` 的服务端设置，优先新版 secret；只向 Supabase 发送密钥。
stdout 为 JSON；错误仅输出阶段标签，不输出异常原文、响应体或凭据。

- NCSS 使用独立 Python/Playwright 进程，固定 `playwright==1.63.0`，不依赖 Node ingestion。
- 默认抓第一页 2 条，允许 1–20 条；`full_list=false`。不分页、不请求详情，不推断关闭。
- `source=ncss`、`source_family=public_employment`、`source_tier=trusted_aggregator`。
- 学历原文保存在 `raw_payload.degreeName`；行业按上游可选字段映射，缺失保持 null。
  不扩展冻结领域字段、不生成 gates；现有列表没有详情/申请链接，相关字段保持 null。
- 只写当前来源的 `source_records` / `source_runs`；失败不改 job-pro 或 `jobs`。
  混合成功记录 `partial`，全失败返回非零；审计写入失败也返回非零，不能保证数据库不可用时留存日志。
- upsert 用现有唯一键，计数只包含确认写入。不要并发启动手动 writer；写入响应不明时先查数据库，不盲目重试。
- 独立 workflow `ingest-ncss.yml` 支持手动和每日 UTC 01:43 运行，单独 concurrency group。
  尚未推送/运行 GitHub Actions；远端仍需配置服务端 Secrets。

真实 fixture 与合成行业样本见 [fixture 说明](tests/fixtures/ncss/README.md)，
实际写入与自审见 [Task 3 smoke 报告](docs/reports/2026-09-28-task3-ncss-smoke.md)。

## Task 4 canonicalization

```sh
npm run canonicalize -- --dry-run
npm run canonicalize -- --write
```

命令使用同一服务端 Supabase 配置，读取完整的小规模快照，再生成 `jobs`。
先应用 `20260928122238_canonicalization_reliability.sql`；本项目真实 Supabase 已应用。
来源 ingestion workflow 保持独立，本阶段 canonicalization 通过上述命令单独运行。

- 同 `(source, source_job_id)` 取最新记录。同源不同 ID 不合并。
- 跨源仅接受 NFKC、大小写、空白归一化后的 company/title 精确一致、地点交集、
  明确且一致的 recruitment_batch，以及无冲突的 internship_type。批次未知/空白也不合并。
- 不删除公司后缀、不做别名猜测/模糊匹配。不通过传递关系桥接不兼容记录，
  同源多个候选也不任意择一。未确定时保留两条。
- 字段采用权威等级最高的完整记录；同等级按抓取时间、稳定身份选择，不拼造字段。
  `canonicalization_trace` 记录主来源、自动 merge reason 和来源状态依据；命令输出全部 pair 决策。
- `raw_content_hash` 只涵盖 canonical 内容，排除抓取时间与运行状态。
  复跑保持 ID；合并保留已有 ID，拆分避免重复分配。新岗位 `gates=[]`，提取元数据为 null；已有岗位保留最后成功提取结果。
- `record_observations` 是可选的运行审计快照：`{present: source_job_id[], closed: source_job_id[]}`。
  closed 只能来自明确上游状态，不能由 HTTP 错误、过期 deadline 或文本猜测生成。
  历史 null 快照不表示空列表，不从当前可变的 last_seen_at 反推历史缺失。
- 现有 bounded run 仅通过 last_seen_at 落在成功 run 时间窗口内确认出现；
  官方出现为 open，NCSS 出现仍为 unknown。状态表示最新已记录证据，未额外引入时间 TTL。
- 只有 authoritative、success、full_list 且有完整快照的连续两次缺失才能关闭。
  full_list 必须覆盖整个 source key 的全部 program；只扫 campus/intern 子集不可标全量。
  failed/partial 不增加 missing count，并打断连续缺失链；NCSS 缺失不增加权威计数。
  明确的闭合证据可以立即关闭；同组权威证据冲突则保守 unknown。
- 写入 RPC 使用事务、输入版本检查和“每个 source record 恰好关联一次”校验。
  只更新 canonical jobs，不改来源记录或运行状态；来源变动导致 stale plan 时需重新预览。
  调用仅服务端可用，维持已有 RLS。网络响应不明时先查数据库，禁止盲目重试。
- M0 快照预算为 1,000 source records / 10,000 source runs，超出明确失败而非截断。
  RPC 超时 30 秒，CLI 整体预算 60 秒。没有新增队列、ORM、embedding 或 LLM。
- Task 5 迁移接续提取保护：canonicalization 更新内容和哈希时不覆盖 gates/提取元数据，
  新内容由独立 extraction runner 处理；旧结果的输入哈希可用于识别过期提取。

真实 8→8 写入、幂等复跑、状态测试和自审见
[Task 4 报告](docs/reports/2026-09-28-task4-canonicalization-smoke.md)。

## Task 5 Gate Extraction

先应用 `20260928175131_gate_extraction.sql`（真实 Supabase 已应用）。在 `.env.local` 配置
`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL=https://api.deepseek.com`、`DEEPSEEK_MODEL=deepseek-flash`。
只使用服务端 Responses API `POST /responses`、封闭 JSON Schema 和独立 runtime validation。
不创建新的 SDK、ORM、队列、定时工作流或 UI。

```sh
# 1–6 个现有 job UUID；只预览，不调用模型、不写入
npm run extract:gates -- --preview JOB_UUID
# 只提取新增/内容变化岗位，验证后写入
npm run extract:gates -- --write JOB_UUID
# 六条 Spike 真实样本 live 回归；不写数据库
npm run extract:gates -- --corpus
```

- Parser 优先覆盖明确在校身份、毕业届别、学历、专业、每周天数、实习月数、已审研究领域和简单 OR。
  标题单独届别保持 ambiguous/program；专业/经验优先保持 preferred。描述中的工作职责不当作任职条件。
- 仅未解析的复杂/歧义子句发给模型，不发送旧 gates、raw payload、整个源记录或环境配置。
  `reasoning.effort=none`、`temperature=0`、最多 4096 输出 tokens，单请求 90 秒，无自动重试。
- Evidence 必须逐字来自所标记的 title/description/requirements。字段、值、上下文、偏好、标题届别、
  OR 和模型输出范围均独立校验；required gate 还需确定性语义确认。整次提取无效则不替换旧 gates。
- 专业/研究词表沿用 Spike；未知专业列表不删掉未知备选项来缩窄条件，整句保留非阻断 metadata。
  冻结契约无法表达的 compound AND/OR 保留原文与 OR 分支，不进入资格比较。
- `extraction_input_hash` 标记最后成功结果；`extraction_attempt_hash` 标记最后尝试，包括失败。
  哈希相同始终跳过模型，版本变化也不自动重抽。失败保留成功 gates、时间、版本和 metadata，记录失败状态。
  失败后的修复需人工核实并显式处理；不提供自动清缓存或无差别重试入口。
- 写入 RPC 用当前内容哈希和上次尝试哈希做 CAS，避免陈旧结果覆盖新 JD。
  仅服务端可调用；不要并行运行 writer（CAS 防止覆盖，但不承诺并发启动时的模型调用去重）。
  传输结果不明先查数据库，再决定是否重试。单条模型失败不会阻止随后岗位；数据库写入不明时停止。
- CLI 每次最多 6 条、整体最多 12 分钟。成功/失败输出只含 ID、计数、耗时和固定错误码；不输出密钥或供应商错误正文。

回归来源见 [fixture 说明](tests/fixtures/gates/README.md)，真实结果与失败修复见
[Task 5 报告](docs/reports/2026-09-29-task5-gate-extraction-smoke.md)。

## M0.5 Phase 1B 批量 Gate Extraction

```sh
# 只读 parser classification，不调用模型
node --import tsx scripts/ingest/run-batch-gate-extraction.ts --preview
# 显式写入；同一文件用于恢复，116 是整个 checkpoint 生命周期的 HTTP 调用硬上限
node --import tsx scripts/ingest/run-batch-gate-extraction.ts --write .verification/phase1b/checkpoint.json 116
```

批处理最多 500 jobs，串行并发 1，调用 cap 必须显式提供且最多 200。模型仍为服务端 `deepseek-flash` Responses API、90 秒超时；仅 unresolved clauses 调用模型。传输/5xx 最多重试一次，退避 1500ms；结构/证据拒绝不重试。调用额度在 HTTP 请求之前落盘，包括重试与中断时可能已发出的请求。

复用 Task 5 parser/schema/validator/RPC，未修改语义。current successful + current version 跳过；失败或明确 stale 仅在显式批次中重试：条件 PATCH 校验 ID/hash/attempt/status/version/attempted_at，清除 attempt hash、标记 retry_pending，但保留旧 gates/成功 metadata；随后仍由既有 RPC 进行 CAS 写入。旧单条 runner 的默认同 hash 跳过行为不变。

同一 checkpoint 的已完成失败不自动重复调用；重新尝试需先检查失败原因，再显式使用新 checkpoint。不要更换 checkpoint 来绕过预算。模型结果在写库前保存，写入响应不明时批次停止，下次先读取 DB，再复用已保存结果。SIGINT/SIGTERM 在当前岗位落盘后停止；强制终止留下的 `started` 标记视为 uncertain，不自动重发。确认原进程已停止、核对数据库后方可清理残留 `.lock`；不要并行运行其他 writer。检查点为本地运行日志，不替代数据库 extraction readiness，勿提交到 Git。

真实批次：396 pending，307 parser-only 成功，58 次模型调用（26 通过 / 32 拒绝），31 parser 校验失败；共 341 ready / 63 failed。详见 [Phase 1B 报告](docs/reports/2026-10-03-m05-phase1b-batch-extraction.md)。未执行 Actions / Deployment。

## 冻结契约约定

- `src/lib/domain/source-record.ts` 是所有来源唯一的标准化契约；`scripts/ingest/contracts.ts` 直接复用它。
- 缺失源信息保留 `null` 或空数组。数据库生成来源记录 UUID；CanonicalJob 按架构使用 `source_record_ids`，不嵌入原始载荷。
- `QualificationProfile` 与 `PreferenceProfile` 不共享字段；资格引擎不接受偏好作为判断条件。
- `GateValue`：`one_of` 表示任一允许值；天数/月数用 `minimum`；学历可用 `education_minimum`。学生状态值为 `enrolled | graduated`；学历值为 `secondary | associate | bachelor | master | doctorate`。未知资料使用 `null`，不能猜测映射。
- `or.alternatives` 保留各分支的 `field` 和 `value`，支持跨字段 OR；整个 OR 仍是一条 gate。外层 `field` 仅用于主展示，必须出现在分支中。嵌套 Boolean/AND 等未支持表达式会拒绝，不拆分成多个必需条件。
- `validateGate(unknown)` 严格检查值域、字段和值的组合、非空证据、上下文包含引文及未知属性，原样保留引文。它不持有原始 JD，**不能证明引文来自原文**；Task 5 的 `validateExtraction` 在写入前另做原文核验。

## 数据库与验证边界

`supabase/migrations/0001_job_radar_m0.sql` 仅创建 `source_records`、`jobs`、`source_runs`。
来源身份唯一键为 `(source, source_job_id)`；岗位默认状态为 `unknown`、缺失计数为 0；迁移不包含推断关闭或提取逻辑。

三表启用 RLS，既有 Supabase `anon` 数据库角色仅可读取 `jobs`；原始载荷、运行日志及所有写入仅供服务端角色访问。未引入 Supabase Auth、账户或登录。
UUID 数组形式的来源关联由后续 canonicalization 维护，不增加关联表或数据库 gate 图。

测试用 PGlite 在本地执行原始 SQL，验证唯一性、JSONB 往返、约束与读写权限；它只是开发测试依赖，不是产品数据库或新服务。
PGlite 测试本身不代表真实部署；Task 2–5 已分别应用迁移并完成真实 Supabase smoke。Task 6 不改数据库或重新运行 extraction。

## Task 6 本地资料与资格判断

- `/onboarding`：两步，四项必填基本资格 → 可选时间/城市；无需登录，不显示 completeness 百分比。
- `/profile`：默认只读，可修改资格资料与偏好；可确认清除本浏览器的 Job Radar 数据。
- localStorage key：`job-radar:guest-profile:v1`。单条版本化记录 `{version:1, qualification, preferences}`，两个领域对象严格分离。
  空白选填数值保持 null；研究方向 null=未填写，[]=明确暂无。只有成功写入才显示保存成功；写入失败保留草稿。
- `createLocalProfileStore` 提供 read/write/clear；clear 仅删除 `job-radar:` 命名空间，不调用 `localStorage.clear()`。
  读到损坏或不支持版本时显示恢复入口，不自动覆盖。当前页同步发布更新，其他标签页通过 storage event 同步。
- `useQualification(job)` 随本地资料更新同步调用纯函数 `evaluateQualification`，不触发 fetch、模型或 extraction。
  Task 7 Radar 与详情复用同一 store 和纯函数，Profile 修改立即在本地重算。
- 资格计算先 Closed→Excluded，再检查 Task 5 的 `extraction_status`、`raw_content_hash`、
  `extraction_input_hash`、`extraction_attempt_hash`、`extraction_error`。只有 success、非空且一致的三份 hash、无 error 才可消费。
  缺字段/未处理/失败/过期统一 Check，reason=`qualification_data_unavailable`；不能仅凭 gates=[] 得出 Eligible。
- Ready 后按冻结顺序：required clear fail→Blocked，required unknown→Check，ambiguous non-pass→Check，否则 Eligible。
  preferred 永不阻断，偏好完全不参与。OR 任一 pass 即 pass，全 fail 才 fail，其余 unknown。
  未识别专业不猜测成不符合；“相关专业”不匹配保留 Check。理由带原 Gate/evidence，不改写证据。

原始 24-case 来源与 M0 表示映射见 [truth table 说明](tests/fixtures/qualification/README.md)。
验证与限制见 [Task 6 报告](docs/reports/2026-09-29-task6-guest-profile-qualification.md)。

## Task 1 交付记录

- 已执行 RED → GREEN：契约文件不存在时测试失败；实现后契约测试通过。
- `lint`、`typecheck`、69 项测试及生产构建通过。
- 已自审字段/SQL 对齐、来源隔离、偏好隔离、OR 和证据校验、访问权限及范围；未发现阻塞问题。
- Task 1 已由用户验收并提交为 `1f5f034`；没有修改全局 Git 配置。

## Task 7 / M0 最终交付

- `/radar` 默认 Browse，搜索、地点/资格筛选、资格优先/收录时间排序；Blocked 默认保留。
- q/city/status/sort/job 使用 URL 状态；支持刷新、Back/Forward、选中岗位 deep link。
- >=1280px 使用可调宽 Peek；中屏 overlay；移动端 full-screen detail；显式进入 `/jobs/[id]` 阅读完整原文和打开官网申请链接。
- Gate → 原因 → verbatim Evidence → Context；readiness 保护和 preferred 非阻断语义不变。
- 页面仅通过 server-only 模块读取 Supabase；浏览器不执行 ingestion、extraction 或模型请求。
- 最终品牌为 `public/brand/` 三个纯 SVG；公司图标来自 `public/company-marks/`。设计历史图片不被生产代码引用。
- 最终检查和桌面/移动复现入口见 [browser acceptance](tests/browser/README.md)。离线测试仍使用 `npm test`。

### 文档时间与运行边界

阶段报告、Implementation Plan 原始 checklist 及 DESIGN 中“本轮/当前只做 Pre-Task7”等文字保留其建立时的上下文，不代表当前交付仍停在旧阶段。当前完成状态以本节和 M0 Final Acceptance 为准；冻结语义和视觉规则不变。

M1 未实现：Saved、Hide/Undo、Seen/New、inline profile completion 等。后续基础设施事项：当前未配置 Git remote、未 push/部署，GitHub Secrets/Actions 尚未远端验证；canonicalization 与 extraction 仍为显式串行后台命令，来源工作流不会自动串起整条更新流水线。接入 `supabase db push` 前须对齐历史初始 migration 版本，不能重复执行 DDL。以上不是新增产品功能或已完成的远端运行承诺。

## M0.5 Phase 2A refresh（远端 smoke 待验证）

复用 `.github/workflows/refresh.yml`，现在显示为 **Refresh Job Radar**：ingestion/admission → canonicalization → incremental extraction → evidence/identity verification → summary。NCSS 仍独立手动入口；两个 workflow 共用 `job-radar-production-writer` 并发锁。真实 remote manual smoke 成功前，两个 schedule 均停用。

默认八个 Batch A、intern、每页2条/每源1页2条/全局16条、模型最多8次；手动输入只能选择既有 allowlist。单次45分钟上限。密钥仅在运行步骤注入；需要 repository Actions Secrets `SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`DEEPSEEK_API_KEY`；DeepSeek URL/model 为固定非秘密配置。

新增或内容哈希变化进入现有批处理；current successful 不重复调用；同 hash failed（含 Phase 1B 的63条）继续 Check，不自动重试。版本过期的成功结果可重新处理。bounded/full_list=false 保持不变；本流水线不引入新的 Closed。

恢复：从目标 run 下载 `refresh-checkpoint` artifact，手动填写该 run ID 为 `resume_run_id`，其余输入保持一致。artifact 仅保存明确列出的 checkpoint/summary，保留14天，不包含 `.env` 或环境快照。ingestion 完成后恢复可跳过抓取；若中途尚未落盘 ingestion 完成状态，恢复可能重新读取有界来源并稳定 upsert，不承诺 source reads exactly-once。模型逐请求额度先落盘，沿用 Phase 1B 的 uncertain 人工核对规则。runner 丢失或强杀可能无法上传 artifact，此时不要自动重试可能已计费的请求。

exit 0 表示处理完成（summary 可为 partial，成功来源仍保留）；未完成、写入不明、预算耗尽或全部来源失败为非零。固定本地目录 `.verification/refresh`：同目录 checkpoint 表示恢复，新一轮须显式归档旧目录；不并行运行其他本地 writer。

迁移历史：本地初始 `0001_job_radar_m0.sql` 对应远端 `20260928013502_job_radar_m0`，后两条版本一致；从零重放后3个 RPC函数定义 MD5与远端精确一致。保留这一命名 debt，不运行 destructive reset 或盲目 db push；新环境按三文件顺序重建，接入 CLI migration repair 前先比对实际 schema。
