import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Job Radar" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body><div className="site-header"><Link className="brand" href="/profile">Job Radar</Link><nav aria-label="主导航"><Link href="/profile">我的资料</Link></nav></div>{children}</body>
    </html>
  );
}
