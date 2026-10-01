# Task 7 narrow visual refinement v2

日期：2026-09-30。保留现有 Task 7 实现，仅进行本轮视觉精修；不进入 M1，不安装 Hallmark，不新增依赖。未修改 qualification engine、readiness、extraction、Source 契约或数据库。停止在截图审查点，未创建最终 Task 7 commit。

## 本轮修改文件

- `src/app/globals.css`：局部 v2 样式覆盖，列表密度、工具条、Sidebar、selected state、详情阅读节奏和移动筛选。
- `src/components/company-mark.tsx`：轻量公司标识与加载失败 fallback。
- `src/components/radar/job-row.tsx`、`src/components/job/job-detail.tsx`：在公司名前展示标识。
- `src/components/radar/filter-bar.tsx`：移动端筛选展开入口，沿用原有 URL 筛选状态。
- `src/components/radar/radar-client.tsx`：移除右上 slogan，缩短排序提示。
- `src/components/radar/detail-peek.tsx`：未保存宽度时默认 40% Detail；保留用户保存宽度与 520–760px 限制。
- `public/company-marks/{tencent.png,xiaomi.ico,vivo.ico,boc.ico,README.md}`：官方站点图标、本地资源与来源记录。
- `tests/browser/task7_acceptance.py`：适配移动筛选展开操作。
- 本报告与 `docs/reports/assets/task7-refinement-v2/` 截图。

以上为本轮文件；工作区还保留此前 Task 7 未提交实现。

## 视觉调整与边界

公司图标使用官方站点 favicon，18px 图形 / 24px 中性轻底容器，灰度显示，不抢标题。仅精确名称映射；无图标或加载失败使用公司首字符，不推断公司身份。腾讯、小米、vivo、中国银行图标正常加载，NCSS 其他公司使用 fallback。来源详见 `public/company-marks/README.md`。

JobRow 从原先约 116px 的基础高度压缩至实际普通行约 98px；标题、公司与 meta 间距收紧，长标题及异常信号仍允许自然增高。Sidebar 收至 202px。工具条统一控件高度与基线，主搜索框保持突出，弱化标签。选中态采用低对比底色与细竖线，箭头降低权重。

1600×1000 的新浏览器会话中 Detail 实测 526.8px，列表与详情约 60:40。较窄桌面受 520px 阅读下限约束，超宽屏受 760px 上限约束；用户已保存的宽度优先，不清除用户偏好。

移动端取消三列挤压，默认显示“筛选与排序”入口；展开后地点、资格、排序各占一行，44px 控件与 16px 输入字号。原有查询参数、刷新、前进后退行为保持。结果数与短排序提示分布两端。

详情调整标题、meta、CTA 与资格区的间距；证据使用轻量展开标记、细引文线与缩进上下文，保留 Gate → 逐字 Evidence → Context → Full JD 路径。视觉强调仅位于 graphite 品牌标识/主按钮、中性 logo 容器、细选中边线和已有克制状态文字。未添加新状态色或装饰动画。

## 验证与自审

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：17 files / 292 tests 通过。
- `npm run build`：通过。
- `tests/browser/task7_acceptance.py`：桌面与移动完整流程通过；搜索、筛选、URL 刷新/历史、Peek、证据与上下文、完整详情、官网链接、Profile 即时重算、空状态均正常。Profile 保存请求数为 0，浏览器异常为 0。
- `tests/browser/task7_responsive.py`：390 / 1100 / 1280 / 2560 通过；无横向溢出，键盘可用。仅浏览器响应模拟 NCSS failed，8 个岗位仍可使用，没有写入或更改真实 source 状态。
- 本轮截图专项：移动筛选 Enter 展开可用、控件高度 >=44px；真实 logo 全部加载。拦截 vivo 图标加载时成功显示 V，8 个真实岗位继续可用。
- `git diff --check`：通过，仅存在已有换行符提示。
- 自审：保持图片辅助语义（空 alt、公司正文仍可读），使用精确公司映射；未更改数据/资格逻辑。浏览器验收脚本已随新移动入口更新，避免隐藏控件测试失真。

## 截图与已知限制

截图来自本地 production build、真实 Supabase 8 个 canonical jobs；通过真实 onboarding 保存本地 Profile：在校、2027、本科、机械工程，可选项及偏好为空。未使用 mock marketing 数据；没有运行 extraction 或调用 DeepSeek。

- `assets/task7-refinement-v2/desktop-browse.png`：1600×1000。
- `assets/task7-refinement-v2/desktop-inspect.png`：真实 vivo Detail Peek，展示已选岗位与逐字证据。
- `assets/task7-refinement-v2/mobile-radar.png`：390×844。
- `assets/task7-refinement-v2/mobile-detail.png`：390×844，真实移动 Detail Peek。
- 补充：`mobile-filters.png`、`mobile-full-detail.png`。

favicon 采用各品牌可用的小图标，细节表现不完全一致；以统一尺寸和灰度控制差异。长公司名与多地点仍按真实文本自然换行。此轮未追求统一素材重绘、重做 IA 或更广泛视觉重构，等待截图审查。
