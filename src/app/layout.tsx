import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
export const metadata: Metadata = {
  title: "Job Radar",
  icons: { icon: { url: "/brand/favicon.svg", type: "image/svg+xml" } },
  description: "从岗位条件出发，核对资格与原文证据。",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <NuqsAdapter>
          <AppShell>{children}</AppShell>
        </NuqsAdapter>
      </body>
    </html>
  );
}
