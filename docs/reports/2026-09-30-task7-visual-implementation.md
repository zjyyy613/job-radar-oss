# Task 7 Visual Implementation Pass

日期：2026-09-30。以真实 Task 7 v2 为基底，执行已批准的视觉改进。未使用被否决融合稿的数据、Profile、状态或卡片风格；未生成新方向，未进入 M1，未提交最终 M0 Freeze。

## 修改文件

- `src/app/globals.css`：恢复原始 logo 色彩；按列表容器宽度组织 row；突出搜索、弱化筛选；selected hover 保持唯一底色；去掉详情顶部圆角，收紧身份/动作组与 gate 内部距离。
- `src/components/radar/job-row.tsx`：既有标题/公司组成身份区，地点与收录时间拆成可对齐的文本，既有异常信号保持原文和逻辑。
- `src/components/job/job-detail.tsx`：把既有 qualification result 的 gate 原因传给对应 gate；不重新计算逐项 pass/fail，不新增状态。
- `src/components/job/gate-row.tsx`：在该 gate 的证据前展示已有原因；note、逐字 evidence、context 保持。
- `public/company-marks/README.md`：同步原色展示说明，未替换资产。
- 本报告与 `assets/task7-visual-implementation/` 截图。

本轮未改 package/lockfile、领域逻辑、SQL、extraction、Profile 存储、来源规则、冻结设计文档；之前 Task 7 未提交内容仍保留。

## 最终视觉行为

18px 原色图形位于 24px 中性容器，失败继续首字符 fallback。列表可用宽度 >=650px 时，身份 / 地点及收录时间 / 最高价值资格信号具有稳定横向位置；没有新增领域字段、列头、复选框或动作菜单。较窄列表回到紧凑多行。普通桌面行实测 96px，长文字自然增高。

搜索独占顶部输入行，地点/资格/排序在下方弱化，仍是相同控件与 URL 状态。Radar 标题收小，不竞争搜索。Sidebar 内容、导航及本地说明未扩展。选中行只用中性浅底及 2px 细线，无阴影或品牌色边框。

1600px 桌面下 Detail 实测 526.8px，延续约 60:40 的 list/detail；现有保存宽度与 520–760px 阅读约束保留。详情是连续阅读面，顶部 logo/公司/职位/meta/投递/Full Detail 收紧。不同 section 间距 24px；gate 内原因、证据更紧，移动 disclosure 仍 >=44px。无大语义色块、绿色勾墙或状态 pills。

## 数据与截图真实性

本轮只读真实 Supabase 数据，不执行 ingestion/extraction、不调用 DeepSeek、不写 jobs。浏览器通过现有 onboarding，在隔离测试会话中使用与 v2 截图相同的真实本地 Profile：在校 / 2027 / 本科 / 机械工程（存储值 mechanical），可选字段 null、偏好空。未改用户其他浏览器会话的资料。

逐一核对已有快照的 8 个 job id、title、company，与当前页面一致。相同 Profile 下 5 Eligible、3 Blocked、0 Check、0 Excluded；列表仍不展示 Eligible 药丸。选中 vivo `6315d88f-cff0-8e58-a9b9-b44c7100e88d`，标题“Agent 算法工程师- 27届蓝极星”，因学历要求保留“存在明确不符合项”；原文 quote 为“2027届获得博士学历”。未借用参考图中的小米/虚构职位、错误年份或假 freshness。

- [Desktop Browse](assets/task7-visual-implementation/desktop-browse.png)
- [Desktop Inspect](assets/task7-visual-implementation/desktop-inspect.png)
- [Mobile Radar](assets/task7-visual-implementation/mobile-radar.png)
- [Mobile Detail](assets/task7-visual-implementation/mobile-detail.png)
- 补充：[Mobile filters](assets/task7-visual-implementation/mobile-filters.png)、[Mobile Full Detail](assets/task7-visual-implementation/mobile-full-detail.png)

## 验证

| 检查 | 结果 |
| --- | --- |
| lint | 通过，0 warnings |
| typecheck | 通过 |
| tests | 17 files / 292 tests 通过 |
| build | 通过，Next production build |
| 桌面 + 移动完整验收 | 通过，搜索/筛选/URL 刷新和历史/Peek/Full Detail/证据上下文/官网链接/Profile 修改均正常 |
| Profile 即时重算 | 本科 Blocked → 博士 Eligible；保存请求数 0；该交互仅发生在测试会话，最终截图仍本科 |
| 响应式 | 390 / 1100 / 1280 / 2560 全流程通过；额外 320 / 375 / 768 检查无横向溢出 |
| 键盘/移动 | focus、Enter、Escape、调宽及返回焦点通过；移动展开筛选/触控目标、16px 输入保留 |
| 空/异常状态 | 搜索空结果及清除、无效岗位恢复通过；仅浏览器响应模拟 NCSS failed 时 8 岗位可用 |
| 数据错误恢复 | 独立本地 3001 进程用无效 URL 模拟，重试与进入本地 Profile 正常；未改 env 文件 |
| logo | 正常资产 naturalWidth >0；CSS filter 为 none；拦截图标加载后 V fallback 正常 |
| reduced motion | 浏览器回归确认 transitionDuration 为 0s |
| diff check | 通过；仅已有 LF/CRLF 提示 |

首次截图的 5s 断言在远程加载完成前超时；独立检查确认数据正常，截图等待提高至 30s 后通过。服务端记录的 destination stream closed early 与提前关闭失败截图会话一致；后续页面无 browser pageerror。没有修改产品网络逻辑或用 mock 顶替截图。

## anti-ui-slop finish gate

基于已读取的 polish / craft / audit / Finish 规则：实际渲染并观察上述四张截图，比较当前最佳参考的机制与 DESIGN。搜索入口、标题权重、扫描位置、有限品牌色和连续详情面符合本轮范围；长标题、多地点保留真实文本且不溢出。空结果、错误恢复、部分来源失败、Profile 重算与主要键盘行为已验证。没有未解决的本轮阻断问题。Loading 保留原有组件，本轮未专门截取加载中画面；不把静态图当作性能测试。

## web-design-guidelines audit

已读取本轮官方在线规则；以 DESIGN 和用户范围优先。

- `src/components/radar/job-row.tsx:33`：PASS，原生 button 与 aria-pressed 保留；标题正常换行；字段分组不新增交互；日期保持收录语义。
- `src/components/job/job-detail.tsx:126`：PASS，仅关联现有 engine 原因；loaded 前不展示推断原因；链接语义、readiness 与 CTA 保留。
- `src/components/job/gate-row.tsx:22`：PASS，原因位于 evidence 前；原文及上下文无改写。
- `src/app/globals.css:1433`：PASS，container query 按真实列表宽度响应；焦点/reduced-motion 保留；移动输入与触控目标通过，未以 overflow hidden 掩盖长文本。

审计限于本轮变更和已列运行场景，不宣称全站或所有辅助技术认证。未因为通用建议新增虚拟列表、依赖、暗色主题。

## Hallmark audit（只读）

本轮用户明确允许 audit，覆盖旧的 study-only 限制仅限此用途；未使用 default/build/redesign，也未修改上游 Skill。

以 DESIGN.md 为判据，未观察到 purple-gradient hero、card-in-card、厚彩色 side-stripe card、KPI/feature grid 或 design-system drift。row 的细中性选中线是已批准的选择反馈，不是装饰卡边。系统 sans、白色输入 surface 与结构一致性是冻结基线，不执行 Hallmark 通用换字体/换主题/结构多样性建议。CSS 明确记录 design-system: DESIGN.md。

范围内结论：**0 critical · 0 major · 0 minor**。这不是新视觉评分或替代用户验收。

## 自审与限制

修正 selected hover 被普通 hover 底色覆盖的问题；原因展示直接复用既有 result，不新造逐 gate 状态。确认公司图标原色并不染 row 或充当资格色。宽列表的无异常岗位会自然留下安静的信号区域；小图标细节受现有 favicon 质量限制。两者保留待用户视觉判断，不继续自由探索或重画资产。

停止在本轮真实截图审查；不提交最终 M0 Freeze，不进入 M1。
