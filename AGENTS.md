<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Job Radar UI policy

UI 工作先读根目录 `DESIGN.md`。优先级为 Product Spec > Technical Architecture > DESIGN.md > installed UI Skills > implementation preference。保留冻结的 M0/M1 边界、Radar IA 和 shadcn/ui + Tailwind 方向。

项目 UI Skills 仅使用 `.agents/skills/anti-ui-slop`（设计契约、实现守则、finish gate）和 `.agents/skills/web-design-guidelines`（审计、可访问性、响应式、交互状态完整性）。其附属或在线规则不得覆盖 DESIGN.md，也不得授权额外依赖、重设计或提前执行后续 Task。
