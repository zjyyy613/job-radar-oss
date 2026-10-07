# M0.5 Phase 2A — Automated Incremental Pipeline

日期：2026-10-08（Asia/Shanghai）。当前状态：**BLOCKED — GitHub OAuth workflow scope 缺失，尚未完成 remote Actions smoke。**

## 已完成

- 创建用户明确授权的私有仓库 `zjyyy613/job-radar`，设置 origin，保留全部本地 Git 历史，没有初始化远端模板。
- 经用户明确二次授权，配置 repository-level Actions Secrets：`SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`DEEPSEEK_API_KEY`；仅验证名称存在。没有创建 organization secret、修改 .env.local 或输出值。
- 首次推送前扫描全部历史394个 blobs，实际本地凭据匹配0，禁止的 .env 路径0（只有 .env.example）。
- 复用 job-pro workflow 串联 admission → source upsert → conservative canonicalization → inserted/changed/stale detection → batch extraction → evidence/identity verification → summary。
- existing same-hash failed不重新提取；current successful跳过；new/hash changed重新处理。未修改Phase 1B parser、validator、prompt或资格语义。
- bounded source/run、串行模型调用预算与checkpoint沿用已有实现；共享production concurrency group，45分钟timeout，失败/恢复artifact和summary已配置。
- NCSS未扩页、未执行；其既有workflow改为同锁、仅手动。真实remote smoke前不启用schedule。

## Supabase只读核对

远端基线仍为 **404 source records / 404 jobs / 341 ready**。本轮尚未运行真实refresh写入。

三张表均启用RLS；unique(source,source_job_id)、状态/evidence相关约束及字段与本地迁移一致。三份SQL可从空PGlite数据库按序重建，既有SQL回归通过。

| RPC | 本地重建 / 远端定义MD5（相同） |
|---|---|
| apply_canonicalization | a7c628662d7f032c4382ab9f5914aef6 |
| canonicalization_snapshot | 5333c6312de49bf67be5de54fbf7951e |
| write_gate_extraction | b4bb9aed3a4917e59952d455d743fe18 |

无损保留的infrastructure debt：本地初始版本`0001`对应远端`20260928013502`；后两条版本`20260928122238`、`20260928175131`一致。未执行history repair、DDL、reset或db push。后续使用migration CLI前必须解释这一映射，不重复初始DDL；当前新环境可按文件顺序重建，不需要重设计schema。

## 远端阻碍与续接

首次push因本机失效proxy连接失败；只在该次git命令禁用代理（未改全局配置）后成功连接GitHub，但GitHub拒绝上传workflow：OAuth token缺少`workflow` scope。远端Actions尚未dispatch，不能提供真实run统计或宣称PASS。

用户需在本机执行：

```sh
gh auth refresh -h github.com -s workflow
```

完成浏览器授权后，继续：push现有`task-1-m0-contracts`分支及历史 → 确认默认分支/workflow可见 → 手动dispatch保守额度 → 完整日志与Supabase对账 → 再跑一次验证unchanged零模型调用/恢复 → 只有通过后才准备每日一次同pipeline schedule。

本地实现commit：`2b30289`（后续文档/防护提交见Git历史）。没有绕过GitHub权限，也没有把本地测试称作remote smoke。

## 本地验证

lint / typecheck / 21 files、343 tests / production build均通过。覆盖new/unchanged/changed增量、existing failed保留、完成checkpoint恢复、单source失败不回滚其他成功来源、capped缺失不Closed、共享锁配置及server-only Secrets边界；Phase 1B的model budget/previous gates/evidence/uncertain恢复测试继续运行。

## Remote统计

sources/listed/detail/admitted/inserted/updated/unchanged/extraction/model calls/duration：**尚无远端run，未生成。** 当前数据库基线不变。尚不配置schedule，不进入Vercel deployment或M1。

参考：[GitHub workflow dispatch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)、[workflow syntax/concurrency](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)。
