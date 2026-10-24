<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Job Radar UI policy

UI 工作先读根目录 `DESIGN.md`。优先级为 Product Spec > Technical Architecture > DESIGN.md > installed UI Skills > implementation preference。保留冻结的 M0/M1 边界、Radar IA 和 shadcn/ui + Tailwind 方向。

项目内置两个第三方 UI Skills：`.agents/skills/anti-ui-slop`（设计契约、实现守则、finish gate，Apache-2.0）与 `.agents/skills/hallmark`（MIT，仅在明确授权的具体任务中按该任务范围使用，不得自动启用）。两者均为本地开发工具，运行时不参与应用代码，许可与来源见 `THIRD-PARTY-NOTICES.md`。任何 Skill 的附属或在线规则不得覆盖 DESIGN.md，也不得授权额外依赖、重设计或提前执行后续 Task。
