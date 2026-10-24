# Job Radar — UI Design Baseline

本文件是 Job Radar UI 实现的唯一设计基线。当前只完成 Pre-Task7 UI Setup；不实现 Radar，不启动 Task 7，不回改已验收页面。

## 权威与范围

**Product Spec > Technical Architecture > DESIGN.md > installed UI Skills > implementation preference**。

事实来源：
- [Product Spec v1.0](docs/specs/job-radar-product-spec-v1.0.md)
- [Technical Architecture v0.1](docs/architecture/job-radar-technical-architecture-v0.1.md)
- [M0 Implementation Plan](docs/superpowers/plans/2026-09-27-job-radar-m0.md)
- [Task 6 验收记录](docs/reports/2026-09-29-task6-guest-profile-qualification.md)

保留冻结的 M0/M1 边界、Radar IA 与 shadcn/ui + Tailwind 技术方向。设计与 Skill 不得重新定义 Source reliability、Gate、Qualification 或 Guest-first 语义。不得为了视觉效果加入 Saved/Hide、登录、KPI、匹配分数或其他未授权功能。本步骤不安装 UI 运行时库。

## Design direction

**Calm Precision**：Calm / Precise / Neutral / Dense but breathable / Evidence-first。

这是工具型产品，不是营销站或 Awwwards 展示页。参考 Linear / Raycast / Vercel 的工具感与信息密度；Stripe / Apple 仅参考 typography、spacing 与克制感，不复制品牌视觉。

## Colors

| Role | Token |
| --- | --- |
| Canvas | `#F7F7F5` |
| Surface | `#FCFCFA` / `#FFFFFF` |
| Sidebar | `#F1F1EE` |
| Primary text | `#1D1D1B` |
| Secondary | `#6F6F69` |
| Tertiary | `#999992` |
| Divider | `rgba(25,25,22,.08)` |
| Primary action | `#1C1C1A` |
| Primary hover | `#2B2B28` |

Semantic color 极少使用：Eligible 在列表中 mostly silent；Check 使用 muted ochre；Blocked 使用 muted brick red；Unknown 使用 neutral gray。语义色必须辅以文字，不能依赖颜色传意。Tertiary 不承载必须阅读的信息；小号正文优先使用可读的 Primary/Secondary，并检查实际背景上的对比度。

禁止 AI purple、gradient、glassmorphism、glowing UI、traffic-light dashboard。不在本文件擅自新增语义色 hex。

## Typography

- English / numbers：Geist / Inter / system sans。
- Chinese：PingFang SC / Noto Sans SC / Microsoft YaHei / system-ui。
- Job title：15px / 600。
- Body：14px / 400。
- Meta：12px / 400。
- Status：12–13px / 500。
- 不为字体展示扩大标题；移动输入框适用时至少 16px，避免聚焦缩放。

## Geometry

- radius 仅使用 6 / 8 / 10px。
- shadows 仅用于真正的 floating layers。
- 优先 spacing / typography / dividers，再考虑 cards / borders / shadows。
- 使用 Lucide icons；图标服务识别与操作，不做装饰性堆砌。

## Motion

- 100–200ms；仅在有实际反馈价值时使用 opacity / transform / background。
- 明确 transition 属性，不使用 transition: all。
- 尊重 prefers-reduced-motion；必要时关闭动效。
- 不做 decorative cinematic animation，不以入场动画延迟内容与交互。

## Radar interaction and hierarchy

- row-based JobList，不做 card grid；Browse Mode first。
- 点击 row 打开 Detail Peek；Full Detail 必须通过显式操作进入。
- Desktop：detail 可调整宽度、可收起；Medium：overlay；Mobile：List → full-screen Detail。
- Sidebar 视觉退后；不做 KPI dashboard，不重复 verdict pills。
- Positive qualification 在 JobRow 中 mostly silent；列表只显示最高价值的异常或次要资格信号，不把所有 gates/badges 堆进一行。
- Primary action 为 graphite **“官网投递 ↗”**。
- 搜索、筛选、排序与当前岗位的状态行为遵循冻结方案；设计不改变 IA。
- 招聘状态与资格结果分开表达。未完成、失败或 stale extraction 显示“资格信息待确认”，不得因 gates=[] 暗示 Eligible；ready 且确认无 gate 才可无冲突。Preferred 不得视觉暗示硬性淘汰。

## Evidence-first reading

**Gate → verbatim Evidence → surrounding Context → Full JD**。

先让用户理解条件与原文证据，再展开周边上下文和全文。Evidence 必须逐字引用，不改写为 AI 总结。Source / freshness 与内容整合，不放入装饰性卡片；Unknown 或来源故障不得伪装为 Closed。

## Anti-patterns

- No giant rounded cards；no card-inside-card proliferation。
- No oversized hero typography；no gradients；no blue SaaS primary theme。
- No red/yellow/green status dots；no meaningless statistics cards。
- No fake match score；no generic “AI generated” copy。
- No excessive badges/chips。
- 不为了“更惊艳”改变冻结 IA。

## Responsive and accessibility

- Keyboard usable，visible focus；semantics before ARIA。原生控件优先，不重复实现其键盘行为。
- 移动触控目标至少 44px；适用的移动输入字号至少 16px。
- Status meaning 不能只依赖颜色；检查文本和焦点对比度。
- 有意识地设计 empty / loading / error / partial-source-failure；区分无结果、加载中与来源不可用，给出适用的恢复操作，保留其他成功来源可用性。
- 检查长标题、内容溢出、详情打开/关闭的焦点与返回列表行为。
- 尊重 prefers-reduced-motion；不禁用浏览器缩放。

## Project UI Skills and conflict resolution

本项目公开版本包含两个第三方 UI Skills：`.agents/skills/anti-ui-slop` 与 `.agents/skills/hallmark`，上游内容保留原样；来源、固定 commit 与许可见各目录 `UPSTREAM.md` 与根目录 `THIRD-PARTY-NOTICES.md`。`hallmark` 不得自动启用，仅在明确授权的具体任务中使用。（开发历史中曾使用过另外两个 skill 包，因其再分发条款无法确认，已从本仓库及历史中移除；相关历史报告仍按当时事实保留其名称。）

- **anti-ui-slop** 仅用于 product-specific design contract、implementation guardrails、finish gate。本文件即产品设计契约；后续按任务范围核验实际 desktop/mobile 与状态，不重新发明视觉方向。无需付费 UIZZE、MCP 或外部参考才能继续。

已阅读 anti-ui-slop 的 operate/craft/audit 规则。适用边界：

1. anti-ui-slop 的通用 craft 允许某些装饰模式；本项目上述禁用项优先。不得启用 Overdrive、重大 redesign、iOS 或无关工作流来扩大范围。
2. 在线指南要求 transform/opacity-only；本项目允许必要的短 background transition，仍需 reduced-motion 与性能审查。
3. 通用字体、英文大小写与文案风格不能覆盖本文件字号、中文文案和逐字 Evidence；通用 URL-state 建议不能把 Guest Profile 放进 URL。
4. 虚拟列表、暗色主题、媒体、依赖和参考素材等建议仅在冻结范围与实际需求内评估，不构成新增功能、安装包或外部付费授权。
5. 当前只审查设计约束与安装文件，不执行已验收 UI 的重设计，也不声称完成浏览器 UI finish gate。

不安装或启用 Ant Design、GSAP、Cinematic UI、Landing Page Generator、UI/UX Pro Max、high-end-visual-design、redesign-existing-projects。`hallmark` 已安装，但仅供用户明确授权的具体任务使用，不自动启用。
