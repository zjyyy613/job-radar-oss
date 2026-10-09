# Source Metadata Query Patch / Phase 2B readiness

日期：2026-10-09。结论：**READY**，此前来源 metadata 查询 High 已消除。没有部署。

## 最小变更

`src/lib/data/job-read-model.ts` 将去重后的 source ID 顺序分批，每批最多 100；成功结果按 ID 合并并稳定排序，忽略批次外返回 ID。空数组不查询；缺失记录不伪造；单批失败继续后续批次并保留已有成功结果，沿用原有 warning 与返回契约。最多一个 source metadata 请求在执行；source health 查询仍独立。

没有修改 UI、Gate/Qualification/Reliability、source status、schema、migration、来源或依赖。没有执行 ingestion/extraction 或数据库写入。

## 测试与真实证据

- 新增 9 个用例：0/1/100/101/409 IDs、重复 ID、缺失记录、逆序结果、三种批次失败位置及成功结果保留、顺序请求、返回结构。
- lint / typecheck / 22 files、352 tests / production build 全通过；diff check 通过。
- 当前真实数据库为 411 jobs；原有 409 个 ID 全部保留且均有 metadata。增长来自既有 schedule，不是 patch 写入。
- 实际应用 read model：411 jobs / 411 jobs with source metadata / warnings=[]。批次 100/100/100/100/11，source URL 最大 4091 字符，5 批均 HTTP 200，无 Headers Overflow。
- `next start` production `/radar` HTTP 200，无“来源详情暂不可用”提示。
- Chrome desktop 1440×1000、mobile 390×844：411 条列表、qualification-first 排序、资格/城市筛选、腾讯搜索、排序 URL/reload、Detail、verbatim Evidence、Full Detail 的来源及更新时间显示均通过；page errors=0。
- 当前验收 Profile 沿用 Phase 1B。没有修改资格或岗位内容；浏览器证据引用与真实 gate quote 匹配。
- 浏览器请求和 HTML 敏感值检查无命中；20 个生产客户端静态文件扫描无服务端 key。真实密钥只在内存读取，不输出值。
- 只读探针及浏览器证据保存在忽略目录 `.verification/phase2b/`，包括 `browser-patch.json`、`read-model.json`；数据库没有被测试脚本改写。

## 部署就绪复核

- 不再存在已知 Blocker/High。此前 Open→Unknown 调查结论不变，未调整冻结语义；63 条失败继续由 readiness 保护为 Check。
- 已核实首次 [schedule run 37876907152](https://github.com/zjyyy613/job-radar/actions/runs/37876907152) success，因此“首次定时尚未验证”不再是当前状态。manual/schedule 共用 pipeline、writer lock 和 45 分钟 timeout；Secrets 未重新上传。
- 初始 migration 版本映射仍是维护 debt，不阻断已有 Supabase 环境的 REST 读取；部署不运行 db push/reset。
- Actions runtime 警告不造成当前实际运行阻断，不升级依赖。

## 等待确认后的最小部署清单

1. 导入现有私有仓库及 `task-1-m0-contracts`，Next.js preset、Node 24、npm ci / npm run build，默认输出目录。
2. 只配置服务端 `SUPABASE_URL`、`SUPABASE_SECRET_KEY`（无 NEXT_PUBLIC 前缀）；页面通过现有 HTTPS REST reader 读取三张表。Vercel 不需要 DeepSeek Key 或数据库直连密码。
3. 不执行 migration、ingestion、extraction，不复制 Actions schedule 到 Vercel。
4. 先验证部署预览的 Guest/Profile、真实岗位和来源、Evidence、搜索筛选排序、Detail、密钥边界，再按用户授权发布。

本次仅提交查询 patch、测试与报告，未部署，未进入 M1。
