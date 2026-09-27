# Job Radar

当前仅实现 **Task 1 / M0-1：App skeleton + frozen contracts**。

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
尚未引入 Tailwind/shadcn/ui、nuqs、Supabase 客户端、来源依赖或模型客户端；后续任务需要时再安装冻结技术栈中的对应依赖。

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
这些测试不代表已经部署到真实 Supabase，也不覆盖 Task 2–7 的采集、关闭判定、提取或资格引擎。

## Task 1 交付记录

- 已执行 RED → GREEN：契约文件不存在时测试失败；实现后契约测试通过。
- `lint`、`typecheck`、69 项测试及生产构建通过。
- 已自审字段/SQL 对齐、来源隔离、偏好隔离、OR 和证据校验、访问权限及范围；未发现阻塞问题。
- 本地 Git 仓库已初始化。未配置提交身份，commit 待用户处理；没有修改全局 Git 配置。
- 停在 Task 1，未启动 Task 2。
