# Task 6 — Local Guest Profile + Qualification Engine

日期：2026-09-29，Asia/Shanghai。基线提交 `5591e87`。仅 Task 6，未进入 Task 7。

## 结果

- 纯 deterministic Qualification Engine 已实现；原始 Spike **24/24** truth-table 预期通过。
- 新增 extraction readiness 前置保护，复用 Task 5 原有列，没有第二套 extraction 状态。
- 两步 `/onboarding`、默认只读的 `/profile`、本地修改与清除已完成。根路径进入 Profile。
- 本地 Profile 更新同步重新计算资格，偏好不参与判断，无模型/网络调用。
- 没有运行或修改 extraction pipeline，没有读取/写入真实 Supabase，没有 Auth、用户表、Radar、Saved/Hide 或新依赖。

## 资格决策与 readiness

`evaluateQualification(profile, gates, applicationStatus, extraction)` 是无副作用同步函数。前三项保留计划接口含义，第四项只投影 Task 5 已存在的字段；省略第四项也安全返回 Check，不能隐式视为 ready。

1. `application_status=closed` → Excluded，优先于提取状态。
2. 提取必须同时满足：`extraction_status=success`、`raw_content_hash` 非空、`extraction_input_hash` 与 `extraction_attempt_hash` 都等于当前 hash、`extraction_error=null`。
3. 任一提取条件不满足，或 Gate 结构无效 → Check，`reasons[].code=qualification_data_unavailable`，文案“资格信息待确认”；不计算 Blocked/Eligible。
4. 可消费后，严格按 required clear fail → Blocked；required unknown → Check；ambiguous non-pass → Check；其余 Eligible。

因此未处理的 `gates=[]` 为 Check；成功且 hash current 的真实空 gates 可为 Eligible。失败后保留的旧 gates、stale hash 和缺少 readiness 列均不能绕过保护。source Unknown 不被改成 Closed。

preferred 不进入阻断判断，城市/岗位/公司偏好没有传入资格接口。OR 任一分支 pass 即 pass，全 fail 才 fail，其他情况 unknown。教育使用冻结等级序列；数字不做字符串强制比较；未知专业不猜测为矛盾；“相关专业”不匹配保持 Check。返回理由保留原 Gate/evidence，不改写源引文。

## 24-case 的来源与边界

读取用户指定的 `gate-validator.cjs` 与 `data/gate-validation-run.json`，迁入原始 profiles/jobs/expected。已通过程序逐项确认这三段与原文件内容相同，expected 共 24 个、未修改。

测试只适配表示：`phd→doctorate`，旧 operator→冻结 minimum/one_of，旧 major tags/domains→单一 major 及确定性领域关系。完整说明见 `tests/fixtures/qualification/README.md`。

小米 M1 的旧嵌套 AND/OR 与 long_term_research 已在 Task 5 作为非阻断 metadata，Task 6 不新增字段或偷偷执行它。M1 的 P1/P2/P3 因独立 research-area gate 与其明确空数组产生矛盾；P4 有 multimodal 因而满足。四个原始状态保持一致，但不依赖不支持的复合表达式产生 Blocked。简单/跨字段 OR 另有正式引擎测试。

## Profile 与本地存储

key：`job-radar:guest-profile:v1`；结构：

```ts
{
  version: 1,
  qualification: {
    student_status, graduation_year, education, major,
    days_per_week, duration_months, research_areas
  },
  preferences: {
    preferred_cities, preferred_roles, preferred_companies
  }
}
```

- 使用既有 QualificationProfile / PreferenceProfile 契约，没有新增资格字段。
- Onboarding 四项必填；时间和城市可跳过，不推测默认值。空白 optional 数字保持 null。
- `research_areas=null` 表示未提供；`[]` 表示用户明确选择“暂无研究方向”。编辑其他字段时保留这一区别。
- `createLocalProfileStore` 提供 read/write/clear，运行时验证版本、字段和值。单 key 原子保存两个独立对象。
- 损坏 JSON / 不支持版本只报错，不静默覆写；存储被禁用时提供可见错误；写入失败不显示成功，保留表单草稿供重试。
- clear 带用户界面确认，只删除 `job-radar:` 命名空间；其他应用数据保留。没有调用 `localStorage.clear()`。
- 当前页通过轻量订阅更新；其他标签页通过原生 storage event 同步。`useSyncExternalStore` 有稳定 SSR snapshot，服务端不读取 window/localStorage。
- `useQualification(job)` 订阅同一 store，同步派生结果；Task 6 不新增岗位列表或测试岗位展示页。

## 页面与浏览器验证

采用冻结的 Calm Precision：暖中性色、石墨色操作、行式资料、简单原生表单。没有 SaaS 大卡片、completeness 百分比或登录墙。使用现有 Next/React，未新增 UI/状态基础设施。

实际使用本机 Chrome（通过已有 Playwright 控制）操作：

- 空必填项阻止继续；填写四项后进入第二步；选填留空仍可保存。
- onboarding → Profile 只读 → 修改天数/时间/城市/岗位/公司 → 保存 → reload，值保持。
- 两个标签页即时看到资料更新和清除结果。
- 清除取消不删除数据；确认清除后 reload 仍为空；其他应用 key 保留。
- 损坏 JSON 显示恢复入口并可清除；禁用存储显示错误。
- 模拟 quota 写入失败：没有落库或虚假成功，草稿保留；恢复存储后可重试保存。
- 明确“暂无研究方向”的 [] 在保存、reload、再次编辑后保持。
- 390px viewport 无横向溢出；已查看 desktop Profile 与 mobile onboarding 截图。
- 页面异常 **0**，页面流程外部请求 **0**。

独立临时浏览器 harness 使用生产 `useQualification` + store，实测 `Check → Blocked → Eligible → Eligible（仅修改偏好）→ Check（清除资料）`，更新过程网络请求 **0**。harness 不进入产品路由或提交；测试结果与截图留在 `.verification/task6-*`。

浏览器连接工具初始化失败，agent-browser CLI 未安装，因此复用了已有 Playwright 和已安装 Chrome，没有下载新依赖。开发服务器已在检查结束后停止。

## 测试与自审

最终结果：

| 检查 | 结果 |
|---|---|
| lint | 通过 |
| typecheck | 通过 |
| 全量 tests | **15 文件 / 266 tests 通过**，含原有 NCSS Python bridge |
| 原始 truth table | **24/24** |
| build | 通过，`/`、`/onboarding`、`/profile` 静态生成 |
| Chrome 页面流程 / React 即时重算 | 通过，0 外部请求 / 0 更新请求 |

自审修复：

- readiness 默认缺失必须 Check；失败/过期 gates 不得用于 Blocked。
- 开放式“相关专业”不匹配不能声称明确矛盾。
- 空白 optional 与明确暂无研究方向不可混淆。
- 本地写入失败时保留 onboarding 草稿与重试路径。
- 自由文本专业别名查找使用 own-property 检查，`constructor` / `__proto__` 仍保持普通字符串，避免污染持久化类型。
- 校验 client/server 边界、清除范围、偏好隔离与原始 expected；未修改 frozen spec、领域 Gate/Profile 契约、extraction、迁移或依赖。

## 修改文件与 Task 7 前注意事项

- `src/lib/domain/qualification-engine.ts`、`profile-values.ts`：确定性资格判断与明确值映射。
- `src/lib/profile/local-profile.ts`、`use-local-profile.ts`：本地保存、订阅、派生资格结果。
- `src/components/profile-form.tsx`；`src/app/onboarding/page.tsx`、`profile/page.tsx`、`globals.css`、`layout.tsx`、`page.tsx`：最小页面与共享表单。
- `tests/domain/qualification-engine.test.ts`、`local-profile.test.ts`、`tests/fixtures/qualification/`：原始 truth table 与边界回归。
- README、本报告；`AGENTS.md` / `CLAUDE.md` 为 Next dev 自动生成，已核实生成器及当前版本指南，保留以避免下次启动再次产生未跟踪改动。

没有 Task 6 阻塞遗留。Task 7 接入真实 jobs 时必须一并读取 Task 5 readiness 五个字段，复用本阶段入口；不能另写 `gates.length===0 → Eligible` 的快捷判断。真实提取覆盖仍保持 Task 5 状态，本阶段没有对剩余岗位补跑 extraction。

已停止在 Task 6；不自动进入 Task 7，不推送或部署。
