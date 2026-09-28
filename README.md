# Job Radar

当前已实现 **Task 1 / M0-1** 与 **Task 2：job-pro adapter + source ingestion**，未进入 Task 3。

冻结依据（按优先级）：
- [Product Spec v1.0](docs/specs/job-radar-product-spec-v1.0.md)
- [Technical Architecture v0.1](docs/architecture/job-radar-technical-architecture-v0.1.md)
- [M0 Implementation Plan](docs/superpowers/plans/2026-09-27-job-radar-m0.md)

## 本地运行

使用 Node.js 24 LTS 和 npm；依赖版本固定在 `package.json` 与 lockfile。

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

根页面仅验证 Next.js 骨架可运行，不是产品 Landing。Task 1 不需要环境变量或外部服务。
Task 2 固定安装 `@ha7ch/job-pro@1.2.1`，通过公开 CLI/process 边界使用；未引入其私有 API、ORM、Auth 或状态库。Supabase 写入使用原生 fetch 调用 PostgREST。

## Task 2 ingestion

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

- 单一 allowlist 位于 `scripts/ingest/job-pro-sources.ts`，只有腾讯、小米、vivo。
- 单次调用仅取所选渠道第一页，默认每家公司 20 条，硬上限 50 条。**不是全量采集**，所有 run 均为 `full_list=false`，不能用来推断岗位关闭。
- 只 upsert `source_records` 并写 `source_runs`；不处理 `jobs`、NCSS、canonicalization、gates 或 UI。
- 详情失败时跳过该条，不以稀疏列表覆盖已有详情；其他条目、公司继续处理。混合成功/失败输出 `partial`，不使整个命令失败；全失败或审计写入失败返回非零退出码。
- 每家公司有 5 分钟预算，到期不再启动下一条；在途 CLI/HTTP 请求另有 45/20 秒超时，随后继续其他公司。
- raw_payload 保留原始详情对象；raw_hash 使用稳定 key 排序的 SHA-256，与抓取时间无关。未支持的源字段仍完整保留在原始载荷中。
- 新增/更新计数基于写入前身份查询，仅统计已确认写入；更新包括刷新 `last_seen_at`。不要同时手动运行多个 writer。响应不明时不盲目重试写入，先检查数据库状态。
- 错误日志仅记录阶段标签，不回显密钥、上游原始错误或响应体。

GitHub Actions 支持手动触发与每日 UTC 01:23 定时运行，串行执行，默认 campus / 每家公司 20 条。
启用前在仓库 Secrets 配置 `SUPABASE_URL` 与 `SUPABASE_SECRET_KEY`（或旧版 fallback），并确保已有 Task 1 表结构。
workflow 已加入本地仓库，尚未推送或在 GitHub 上执行。

真实 fixture 的抓取命令与映射边界见 [fixture 说明](tests/fixtures/job-pro/README.md)。
真实 Supabase 写入、复跑与自审记录见 [Task 2 smoke 报告](docs/reports/2026-09-28-task2-job-pro-smoke.md)。

## 契约约定

- `src/lib/domain/source-record.ts` 是所有来源唯一的标准化契约；`scripts/ingest/contracts.ts` 直接复用它。
- 缺失源信息保留 `null` 或空数组。数据库生成来源记录 UUID；CanonicalJob 按架构使用 `source_record_ids`，不嵌入原始载荷。
- `QualificationProfile` 与 `PreferenceProfile` 不共享字段；没有资格判断实现。
- `GateValue`：`one_of` 表示任一允许值；天数/月数用 `minimum`；学历可用 `education_minimum`。学生状态值为 `enrolled | graduated`；学历值为 `secondary | associate | bachelor | master | doctorate`。未知资料使用 `null`，不能猜测映射。
- `or.alternatives` 保留各分支的 `field` 和 `value`，支持跨字段 OR；整个 OR 仍是一条 gate。外层 `field` 仅用于主展示，必须出现在分支中。嵌套 Boolean/AND 等未支持表达式会拒绝，不拆分成多个必需条件。
- `validateGate(unknown)` 严格检查值域、字段和值的组合、非空证据、上下文包含引文及未知属性，原样保留引文。它不持有原始 JD，**不能证明引文来自原文**；Task 5 写入前须另做原文核验。

## 数据库与验证边界

`supabase/migrations/0001_job_radar_m0.sql` 仅创建 `source_records`、`jobs`、`source_runs`。
来源身份唯一键为 `(source, source_job_id)`；岗位默认状态为 `unknown`、缺失计数为 0；迁移不包含推断关闭或提取逻辑。

三表启用 RLS，既有 Supabase `anon` 数据库角色仅可读取 `jobs`；原始载荷、运行日志及所有写入仅供服务端角色访问。未引入 Supabase Auth、账户或登录。
UUID 数组形式的来源关联由后续 canonicalization 维护，不增加关联表或数据库 gate 图。

测试用 PGlite 在本地执行原始 SQL，验证唯一性、JSONB 往返、约束与读写权限；它只是开发测试依赖，不是产品数据库或新服务。
PGlite 测试本身不代表真实部署；Task 2 已另行应用原始迁移并完成 Supabase 真实写入 smoke。关闭判定、提取与资格引擎仍属于后续任务。

## Task 1 交付记录

- 已执行 RED → GREEN：契约文件不存在时测试失败；实现后契约测试通过。
- `lint`、`typecheck`、69 项测试及生产构建通过。
- 已自审字段/SQL 对齐、来源隔离、偏好隔离、OR 和证据校验、访问权限及范围；未发现阻塞问题。
- Task 1 已由用户验收并提交为 `1f5f034`；没有修改全局 Git 配置。
