# Product Improvement v1 · Task 3 — Minimal Saved Jobs

实施／真实浏览验收：2026-10-10；最终复核：2026-10-14；基线：本地 `8c07cd0`。本轮仅解锁最小 Saved，不解锁其他 M1 功能。不 push，不部署。

## 实现

- Radar 行末星标、Detail Peek、Full Detail 使用同一 Saved store。星标是 JobRow 主按钮的同级 button，不嵌套，不传播到岗位打开动作。空心／实心形状、`aria-pressed`、动作标签共同表达状态。
- Sidebar / Mobile 导航增加 Saved；`/saved` 复用当前岗位读取、JobRow、Detail Peek 和资格计算，按最近收藏排序。Full Detail 可返回 Saved 的选中岗位上下文。
- 数据键 `job-radar:saved:v1`，值为 `{version:1, entries:[{job_id, saved_at}]}`。不缓存 JD、公司信息、资格结果或来源数据。
- 每次写入先读取最新 envelope；相同 ID 保存幂等，不刷新原保存时间。成功写入后才发布状态；写入失败保留原状态并显示错误。损坏／未知版本数据不覆盖。
- 同文档使用共享 store，同源标签页监听 storage；仅维护一组浏览器订阅。Profile 现有按前缀清除仍使用原机制，追加本标签页通知并明确文案包括收藏。
- 当前找不到的 ID 保留“岗位暂不可用”条目，显示 ID／保存日期并可移除。读取整体失败使用重试页，不删除本地数据。
- Closed 继续得到 Excluded；详情改为“岗位已关闭，当前不可申请”，仅保留“查看原始岗位”链接，不显示官网投递 CTA。没有改 Closed 计算规则。

## 验证

只读取当前真实 411 条岗位，未调用 ingestion / extraction、未写 Supabase。浏览器使用隔离本地 Guest Profile：2027 / 本科 / 机械。Desktop 1440px、Mobile 390px。

- 2026-10-14 在 390px touch context 补测真实岗位：星标目标至少 44×44px，tap 收藏／取消均生效，不打开详情、无横向溢出。
- 键盘 Space 收藏、取消、刷新恢复；同岗位在 Radar / Peek / Full / Saved 状态一致。
- 收藏不打开详情；详情取消／收藏不关闭详情、也不改变选中 URL。
- 双标签页新增、取消即时同步；Profile 清除后本地 Saved key 移除，另一标签页回到 empty state。
- 注入 QuotaExceededError：取消操作返回失败，按钮保持已收藏，持久化内容完全不变，详情内可见错误；恢复写入后重试成功。
- 注入不存在的 ID：保留并显示不可用，移除只影响该条；其余真实收藏保留。
- 真实岗位“【留用实习】产品运营-商业产品”：跨标签页清除 Profile 后 Eligible → Check，Saved envelope 完全不变，证明使用当前资格而非收藏时快照。
- 当前数据库没有 Closed 岗位；用真实岗位内容构造 closed 状态执行 React SSR 验证，确认关闭文案和来源链接存在、官网投递 CTA 不存在。资格引擎已有 Closed → Excluded 回归仍通过；未修改真实岗位状态。
- Task 1 / 2 回归：1440 / 1024 / 390px 各 6 组真实筛选，逐个对比 ID 与排序；城市搜索、偏好确认、清除、URL reload、Back/Forward、详情往返通过。
- 复测期间遇到 Supabase 读取超时／连接中断；独立只读探针仍成功读取 411 条及完整 metadata，重启本地生产进程并顺序复验后完成。没有为此修改数据层。测试等待 nuqs URL 更新及流式页面本地状态恢复，避免断言竞态。

## Quality / 自审

- lint、typecheck、全量 25 files / 407 tests、production build 通过。
- 新增 12 个离线存储测试：幂等、保存顺序、刷新重建、标签页最新读取、读写失败／重试、损坏数据、清除隔离、不可用 ID、重复 envelope、安全返回地址。
- anti-ui-slop：复用既有行列表、窄星标和详情操作区，不引入卡片墙、tabs 或新设计系统；截图包含真实岗位。
- web-design-guidelines：原生 button、无嵌套、可见焦点、44px 星标触控目标、`aria-pressed`、明确 label、错误 alert、Saved 加载／空／不可用状态，移动导航保留。
- 自审：错误同时放在详情内部，确保 medium/mobile modal 打开时不会只出现在不可访问的背景；Clear 文案包含收藏；Saved 回链仅接受本地路径。
- Task 1 normalization、Task 2 filters、Qualification / Reliability、依赖文件、数据库及 pipeline 未修改。

## 主要文件

- `src/lib/saved/local-saved.ts` / `use-saved.ts`：版本化最小持久化和订阅。
- `src/components/saved/save-button.tsx` / `saved-client.tsx`：星标、错误提示、当前数据列表。
- `src/app/saved/{page,error,loading}.tsx`：当前数据读取与状态。
- `src/components/radar/job-row.tsx`、`src/components/job/job-detail.tsx`、`src/components/app-shell.tsx`：最小入口。
- `src/lib/profile/use-local-profile.ts`、`src/app/profile/page.tsx`：既有清除流程同步／文案。
- `src/lib/radar/url-state.ts`、`src/app/jobs/[id]/page.tsx`：安全 Saved 返回链接。
- `src/app/globals.css`：行末星标、不可用条目与移动导航必要样式。
- `tests/saved/local-saved.test.ts`：存储回归。

## 截图

- [Desktop Saved](assets/minimal-saved-v1/desktop-saved.png)
- [Mobile Saved](assets/minimal-saved-v1/mobile-saved.png)
- [Desktop Radar](assets/minimal-saved-v1/desktop-radar.png)
- [Mobile Radar](assets/minimal-saved-v1/mobile-radar.png)
- [Desktop Detail](assets/minimal-saved-v1/desktop-detail.png)
- [Mobile Detail](assets/minimal-saved-v1/mobile-detail.png)
- [Desktop unavailable](assets/minimal-saved-v1/desktop-unavailable.png)
- [Mobile unavailable](assets/minimal-saved-v1/mobile-unavailable.png)

## 限制

收藏只属于同源、同浏览器，清除站点存储后无法恢复。没有云同步或历史快照。localStorage 不提供多写事务；常规跨标签页操作已测试，极端同时写入仍遵循浏览器最后写入结果。当前数据库没有真实 Closed 样本，关闭 UI 验证为受控渲染。
